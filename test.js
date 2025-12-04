#!/usr/bin/env node

/**
 * Test script for the Caddy routing system
 * Tests database operations, API endpoints, and routing logic
 */

const RoutingDatabase = require('./database');
const fs = require('fs');

const TEST_DB = './test-routing.db';

// Clean up test database if exists
if (fs.existsSync(TEST_DB)) {
  fs.unlinkSync(TEST_DB);
}

const db = new RoutingDatabase(TEST_DB);

console.log('🧪 Running Caddy Router Tests\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    failed++;
  }
}

// Test 1: Rule ID generation
test('Generate rule ID with all parameters', () => {
  const ruleId = db.generateRuleId('example.com', 'api', '/users', ['id', 'page']);
  if (ruleId !== 'api.example.com/users/[id,page]') {
    throw new Error(`Expected 'api.example.com/users/[id,page]', got '${ruleId}'`);
  }
});

test('Generate rule ID with wildcard subdomain', () => {
  const ruleId = db.generateRuleId('example.com', '*', '/api', null);
  if (ruleId !== '*.example.com/api') {
    throw new Error(`Expected '*.example.com/api', got '${ruleId}'`);
  }
});

test('Generate rule ID with no subdomain', () => {
  const ruleId = db.generateRuleId('example.com', null, '/home', []);
  if (ruleId !== '!.example.com/home/[]') {
    throw new Error(`Expected '!.example.com/home/[]', got '${ruleId}'`);
  }
});

test('Generate rule ID with no query params restriction', () => {
  const ruleId = db.generateRuleId('example.com', 'www', '/test', null);
  if (ruleId !== 'www.example.com/test') {
    throw new Error(`Expected 'www.example.com/test', got '${ruleId}'`);
  }
});

// Test 2: Create rules
let testRule1, testRule2, testRule3;

test('Create rule with specific query params', () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  testRule1 = db.createRule(
    'example.com',
    'api',
    '/users',
    ['id', 'page'],
    'http://backend:8080',
    expiresAt
  );
  if (!testRule1 || testRule1.rule_id !== 'api.example.com/users/[id,page]') {
    throw new Error('Rule creation failed');
  }
});

test('Create rule with wildcard path', () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 7200;
  testRule2 = db.createRule(
    'example.com',
    '*',
    '*',
    null,
    'http://wildcard:9000',
    expiresAt
  );
  if (!testRule2) {
    throw new Error('Wildcard rule creation failed');
  }
});

test('Create rule with no query params allowed', () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 1800;
  testRule3 = db.createRule(
    'myapp.com',
    null,
    '/static',
    [],
    'http://cdn:3000',
    expiresAt
  );
  if (!testRule3 || !testRule3.rule_id.includes('[]')) {
    throw new Error('No query params rule creation failed');
  }
});

// Test 3: Retrieve rules
test('Get all rules', () => {
  const rules = db.getAllRules();
  if (rules.length !== 3) {
    throw new Error(`Expected 3 rules, got ${rules.length}`);
  }
});

test('Get specific rule by ID', () => {
  const rule = db.getRule('api.example.com/users/[id,page]');
  if (!rule || rule.downstream_url !== 'http://backend:8080') {
    throw new Error('Failed to retrieve specific rule');
  }
});

// Test 4: Route matching
test('Match route with exact subdomain and path', () => {
  const rule = db.findMatchingRule('example.com', 'api', '/users', { id: '123', page: '1' });
  if (!rule || rule.rule_id !== 'api.example.com/users/[id,page]') {
    throw new Error('Failed to match exact route');
  }
});

test('Match route with wildcard', () => {
  const rule = db.findMatchingRule('example.com', 'test', '/anything', {});
  if (!rule || rule.rule_id !== '*.example.com/*') {
    throw new Error('Failed to match wildcard route');
  }
});

test('Reject route with invalid query params', () => {
  const rule = db.findMatchingRule('example.com', 'api', '/users', { id: '123', invalid: 'param' });
  // Should not match the specific rule, should fall back to wildcard
  if (rule && rule.rule_id === 'api.example.com/users/[id,page]') {
    throw new Error('Should not match route with invalid query params');
  }
});

test('Reject route with query params when none allowed', () => {
  const rule = db.findMatchingRule('myapp.com', null, '/static', { test: 'value' });
  if (rule && rule.rule_id === '!.myapp.com/static/[]') {
    throw new Error('Should not match route when query params provided but none allowed');
  }
});

test('Match route with no query params when none allowed', () => {
  const rule = db.findMatchingRule('myapp.com', null, '/static', {});
  if (!rule || rule.rule_id !== '!.myapp.com/static/[]') {
    throw new Error('Should match route with no query params');
  }
});

// Test 5: Update rule
test('Update rule downstream URL', () => {
  const updated = db.updateRule('api.example.com/users/[id,page]', {
    downstream_url: 'http://new-backend:8080'
  });
  if (!updated || updated.downstream_url !== 'http://new-backend:8080') {
    throw new Error('Failed to update rule');
  }
});

// Test 6: Prune expired rules
test('Create and prune expired rule', () => {
  const pastExpiry = Math.floor(Date.now() / 1000) - 1000;
  db.createRule('expired.com', 'old', '/test', null, 'http://old:8080', pastExpiry);
  const pruned = db.pruneExpiredRules();
  if (pruned !== 1) {
    throw new Error(`Expected to prune 1 rule, pruned ${pruned}`);
  }
});

// Test 7: Delete rule
test('Delete rule', () => {
  const deleted = db.deleteRule('!.myapp.com/static/[]');
  if (!deleted) {
    throw new Error('Failed to delete rule');
  }
});

test('Verify rule was deleted', () => {
  const rule = db.getRule('!.myapp.com/static/[]');
  if (rule) {
    throw new Error('Rule should have been deleted');
  }
});

// Test 8: Domain requirement
test('Reject rule creation without domain', () => {
  try {
    db.createRule(null, 'api', '/test', null, 'http://test:8080', Date.now() + 1000);
    throw new Error('Should have thrown error for missing domain');
  } catch (error) {
    if (!error.message.includes('Domain is mandatory')) {
      throw error;
    }
  }
});

// Cleanup
db.close();
fs.unlinkSync(TEST_DB);

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}

console.log('✅ All tests passed!\n');
