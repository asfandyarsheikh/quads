const Database = require('better-sqlite3');
const path = require('path');

class RoutingDatabase {
  constructor(dbPath = './routing.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  initializeDatabase() {
    // Create routing_rules table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS routing_rules (
        rule_id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        subdomain TEXT,
        path TEXT,
        query_params TEXT,
        downstream_url TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_domain ON routing_rules(domain);
      CREATE INDEX IF NOT EXISTS idx_expires_at ON routing_rules(expires_at);
      CREATE INDEX IF NOT EXISTS idx_subdomain_path ON routing_rules(subdomain, path);
    `);
  }

  /**
   * Generate rule_id from subdomain, path, and query params
   * Rules:
   * - domain is mandatory
   * - subdomain: * for all, ! for none
   * - path: * for all, ! for none
   * - query_params: null = all allowed (not shown in rule_id), [] = none allowed (show as [])
   * Example: api.example.com/users/[id,page,limit] or *.example.com/api/* or !.example.com/!/[]
   */
  generateRuleId(domain, subdomain, path, queryParams) {
    let ruleId = '';
    
    // Subdomain.Domain part
    if (subdomain === null || subdomain === undefined || subdomain === '') {
      ruleId = `!.${domain}`;
    } else {
      ruleId = `${subdomain}.${domain}`;
    }
    
    // Path part - always add with separator
    if (path === null || path === undefined || path === '') {
      ruleId += '/!';
    } else if (path === '*') {
      ruleId += '/*';
    } else {
      // Ensure path starts with /
      if (!path.startsWith('/')) {
        ruleId += '/' + path;
      } else {
        ruleId += path;
      }
    }
    
    // Query params part
    if (queryParams !== null && queryParams !== undefined) {
      const paramsArray = typeof queryParams === 'string' ? JSON.parse(queryParams) : queryParams;
      if (Array.isArray(paramsArray)) {
        if (paramsArray.length === 0) {
          ruleId += '/[]';
        } else {
          ruleId += `/[${paramsArray.join(',')}]`;
        }
      }
    }
    // If queryParams is null, don't add anything (all query params allowed)
    
    return ruleId;
  }

  createRule(domain, subdomain, path, queryParams, downstreamUrl, expiresAt) {
    if (!domain) {
      throw new Error('Domain is mandatory');
    }

    const ruleId = this.generateRuleId(domain, subdomain, path, queryParams);
    const queryParamsJson = queryParams !== null && queryParams !== undefined 
      ? JSON.stringify(queryParams) 
      : null;
    
    const stmt = this.db.prepare(`
      INSERT INTO routing_rules (rule_id, domain, subdomain, path, query_params, downstream_url, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      stmt.run(ruleId, domain, subdomain, path, queryParamsJson, downstreamUrl, expiresAt);
      return this.getRule(ruleId);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new Error('Rule with this ID already exists');
      }
      throw error;
    }
  }

  getRule(ruleId) {
    const stmt = this.db.prepare('SELECT * FROM routing_rules WHERE rule_id = ?');
    const rule = stmt.get(ruleId);
    if (rule && rule.query_params) {
      rule.query_params = JSON.parse(rule.query_params);
    }
    return rule;
  }

  getAllRules() {
    const stmt = this.db.prepare('SELECT * FROM routing_rules ORDER BY created_at DESC');
    const rules = stmt.all();
    return rules.map(rule => {
      if (rule.query_params) {
        rule.query_params = JSON.parse(rule.query_params);
      }
      return rule;
    });
  }

  getActiveRules() {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('SELECT * FROM routing_rules WHERE expires_at > ? ORDER BY created_at DESC');
    const rules = stmt.all(now);
    return rules.map(rule => {
      if (rule.query_params) {
        rule.query_params = JSON.parse(rule.query_params);
      }
      return rule;
    });
  }

  updateRule(ruleId, updates) {
    const allowedFields = ['downstream_url', 'expires_at'];
    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No valid fields to update');
    }

    setClauses.push('updated_at = strftime(\'%s\', \'now\')');
    values.push(ruleId);

    const stmt = this.db.prepare(`
      UPDATE routing_rules 
      SET ${setClauses.join(', ')}
      WHERE rule_id = ?
    `);

    const result = stmt.run(...values);
    if (result.changes === 0) {
      throw new Error('Rule not found');
    }

    return this.getRule(ruleId);
  }

  deleteRule(ruleId) {
    const stmt = this.db.prepare('DELETE FROM routing_rules WHERE rule_id = ?');
    const result = stmt.run(ruleId);
    return result.changes > 0;
  }

  pruneExpiredRules() {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('DELETE FROM routing_rules WHERE expires_at <= ?');
    const result = stmt.run(now);
    return result.changes;
  }

  /**
   * Find matching rule for incoming request
   * Prioritizes specific rules over wildcards
   */
  findMatchingRule(domain, subdomain, path, queryParams) {
    const now = Math.floor(Date.now() / 1000);
    const allRules = this.db.prepare('SELECT * FROM routing_rules WHERE expires_at > ? AND domain = ?').all(now, domain);
    
    const matches = [];
    
    for (const rule of allRules) {
      let score = 0;
      
      // Check subdomain
      if (rule.subdomain === '*') {
        // Wildcard subdomain - lowest priority
        score += 1;
      } else if (rule.subdomain === '!' || !rule.subdomain) {
        // No subdomain expected
        if (subdomain) continue;
        score += 10; // Specific match
      } else if (rule.subdomain === subdomain) {
        score += 10; // Exact subdomain match
      } else {
        continue; // No match
      }
      
      // Check path
      if (rule.path === '*') {
        // Wildcard path - lowest priority
        score += 1;
      } else if (rule.path === '!' || !rule.path) {
        // No path expected
        if (path && path !== '/' && path !== '!') continue;
        score += 10; // Specific match
      } else if (rule.path === path) {
        score += 10; // Exact path match
      } else {
        continue; // No match
      }
      
      // Check query params
      let queryParamsMatch = false;
      if (rule.query_params === null) {
        // All query params allowed
        queryParamsMatch = true;
        score += 5; // Less specific than defined params
      } else {
        const allowedParams = JSON.parse(rule.query_params);
        if (allowedParams.length === 0) {
          // No query params allowed
          if (Object.keys(queryParams).length === 0) {
            queryParamsMatch = true;
            score += 10; // Very specific
          }
        } else {
          // Only specific query params allowed
          const requestParamKeys = Object.keys(queryParams);
          const allAllowed = requestParamKeys.every(key => allowedParams.includes(key));
          if (allAllowed) {
            queryParamsMatch = true;
            score += 10; // Very specific
          }
        }
      }
      
      if (queryParamsMatch) {
        matches.push({ rule, score });
      }
    }
    
    // Sort by score (highest first) and return the best match
    if (matches.length > 0) {
      matches.sort((a, b) => b.score - a.score);
      return this.formatRule(matches[0].rule);
    }
    
    return null;
  }

  formatRule(rule) {
    if (rule.query_params) {
      rule.query_params = JSON.parse(rule.query_params);
    }
    return rule;
  }

  close() {
    this.db.close();
  }
}

module.exports = RoutingDatabase;
