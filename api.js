require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const RoutingDatabase = require('./database');

const db = new RoutingDatabase(process.env.DB_PATH || './routing.db');

// Schema definitions for validation
const createRuleSchema = {
  body: {
    type: 'object',
    required: ['domain', 'downstream_url', 'expires_at'],
    properties: {
      domain: { type: 'string' },
      subdomain: { type: ['string', 'null'] },
      path: { type: ['string', 'null'] },
      query_params: { 
        type: ['array', 'null'],
        items: { type: 'string' }
      },
      downstream_url: { type: 'string' },
      expires_at: { type: 'integer' }
    }
  }
};

const updateRuleSchema = {
  body: {
    type: 'object',
    properties: {
      downstream_url: { type: 'string' },
      expires_at: { type: 'integer' }
    }
  }
};

// Health check
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: Date.now() };
});

// Get all rules
fastify.get('/api/rules', async (request, reply) => {
  try {
    const rules = db.getAllRules();
    return { success: true, data: rules, count: rules.length };
  } catch (error) {
    reply.code(500);
    return { success: false, error: error.message };
  }
});

// Get active rules only
fastify.get('/api/rules/active', async (request, reply) => {
  try {
    const rules = db.getActiveRules();
    return { success: true, data: rules, count: rules.length };
  } catch (error) {
    reply.code(500);
    return { success: false, error: error.message };
  }
});

// Get specific rule by ID
fastify.get('/api/rules/:ruleId', async (request, reply) => {
  try {
    const { ruleId } = request.params;
    const rule = db.getRule(decodeURIComponent(ruleId));
    
    if (!rule) {
      reply.code(404);
      return { success: false, error: 'Rule not found' };
    }
    
    return { success: true, data: rule };
  } catch (error) {
    reply.code(500);
    return { success: false, error: error.message };
  }
});

// Create new rule
fastify.post('/api/rules', { schema: createRuleSchema }, async (request, reply) => {
  try {
    const { domain, subdomain, path, query_params, downstream_url, expires_at } = request.body;
    
    const rule = db.createRule(
      domain,
      subdomain || null,
      path || null,
      query_params !== undefined ? query_params : null,
      downstream_url,
      expires_at
    );
    
    reply.code(201);
    return { success: true, data: rule };
  } catch (error) {
    reply.code(400);
    return { success: false, error: error.message };
  }
});

// Update rule
fastify.patch('/api/rules/:ruleId', { schema: updateRuleSchema }, async (request, reply) => {
  try {
    const { ruleId } = request.params;
    const updates = request.body;
    
    const rule = db.updateRule(decodeURIComponent(ruleId), updates);
    return { success: true, data: rule };
  } catch (error) {
    reply.code(error.message === 'Rule not found' ? 404 : 400);
    return { success: false, error: error.message };
  }
});

// Delete rule
fastify.delete('/api/rules/:ruleId', async (request, reply) => {
  try {
    const { ruleId } = request.params;
    const deleted = db.deleteRule(decodeURIComponent(ruleId));
    
    if (!deleted) {
      reply.code(404);
      return { success: false, error: 'Rule not found' };
    }
    
    return { success: true, message: 'Rule deleted successfully' };
  } catch (error) {
    reply.code(500);
    return { success: false, error: error.message };
  }
});

// Prune expired rules manually
fastify.post('/api/rules/prune', async (request, reply) => {
  try {
    const count = db.pruneExpiredRules();
    return { success: true, message: `Pruned ${count} expired rules` };
  } catch (error) {
    reply.code(500);
    return { success: false, error: error.message };
  }
});

// Route matching endpoint (for Caddy to query)
fastify.get('/api/match', async (request, reply) => {
  try {
    const { domain, subdomain, path, ...queryParams } = request.query;
    
    if (!domain) {
      reply.code(400);
      return { success: false, error: 'Domain is required' };
    }
    
    const rule = db.findMatchingRule(
      domain,
      subdomain || null,
      path || null,
      queryParams || {}
    );
    
    if (!rule) {
      reply.code(404);
      return { success: false, error: 'No matching rule found' };
    }
    
    return { success: true, data: rule };
  } catch (error) {
    reply.code(500);
    return { success: false, error: error.message };
  }
});

// Graceful shutdown
const closeGracefully = async (signal) => {
  fastify.log.info(`Received signal to terminate: ${signal}`);
  db.close();
  await fastify.close();
  process.exit(0);
};

process.on('SIGINT', closeGracefully);
process.on('SIGTERM', closeGracefully);

// Start server
const start = async () => {
  try {
    const port = process.env.API_PORT || 3000;
    const host = process.env.API_HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    console.log(`API server running at http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    db.close();
    process.exit(1);
  }
};

start();
