#!/usr/bin/env node

/**
 * Example script to populate the database with sample routing rules
 * Run: node examples.js
 */

const RoutingDatabase = require('./database');

const db = new RoutingDatabase('./routing.db');

// Helper to get timestamp 30 days from now
const getExpiryTimestamp = (days = 30) => {
  return Math.floor(Date.now() / 1000) + (days * 24 * 60 * 60);
};

console.log('Creating example routing rules...\n');

try {
  // Example 1: API subdomain with specific query params
  const rule1 = db.createRule(
    'example.com',
    'api',
    '/users',
    ['id', 'page', 'limit'],
    'http://backend-api:8080',
    getExpiryTimestamp(30)
  );
  console.log('✓ Created:', rule1.rule_id);

  // Example 2: All subdomains with wildcard path
  const rule2 = db.createRule(
    'example.com',
    '*',
    '*',
    null, // All query params allowed
    'http://wildcard-backend:9000',
    getExpiryTimestamp(60)
  );
  console.log('✓ Created:', rule2.rule_id);

  // Example 3: Root domain, no path, no query params
  const rule3 = db.createRule(
    'myapp.com',
    null,
    null,
    [], // No query params allowed
    'http://main-site:3000',
    getExpiryTimestamp(90)
  );
  console.log('✓ Created:', rule3.rule_id);

  // Example 4: Specific subdomain and path, all query params
  const rule4 = db.createRule(
    'example.com',
    'static',
    '/assets',
    null,
    'http://cdn-server:8080',
    getExpiryTimestamp(180)
  );
  console.log('✓ Created:', rule4.rule_id);

  // Example 5: Admin subdomain with auth token required
  const rule5 = db.createRule(
    'myapp.com',
    'admin',
    '/dashboard',
    ['token'],
    'http://admin-backend:4000',
    getExpiryTimestamp(15)
  );
  console.log('✓ Created:', rule5.rule_id);

  // Example 6: Mobile API with version path
  const rule6 = db.createRule(
    'myapp.com',
    'mobile',
    '/api/v2',
    ['device_id', 'app_version'],
    'http://mobile-api:5000',
    getExpiryTimestamp(45)
  );
  console.log('✓ Created:', rule6.rule_id);

  console.log('\n✓ Successfully created 6 example routing rules');
  console.log('\nView all rules:');
  console.log('  curl http://localhost:3000/api/rules\n');

} catch (error) {
  console.error('Error creating rules:', error.message);
} finally {
  db.close();
}
