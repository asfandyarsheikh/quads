# API Documentation

Complete API reference for the Caddy Dynamic Router system.

## Base URL

```
http://localhost:3000
```

## Endpoints

### Health Check

**GET** `/health`

Check if the API is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1733270400000
}
```

---

### Create Routing Rule

**POST** `/api/rules`

Create a new routing rule.

**Request Body:**
```json
{
  "domain": "example.com",           // Required: Domain name
  "subdomain": "api",                // Optional: subdomain, "*" for all, null for none
  "path": "/users",                  // Optional: path, "*" for all, null for none
  "query_params": ["id", "page"],    // Optional: array of allowed params, null for all, [] for none
  "downstream_url": "http://backend:8080",  // Required: Where to proxy requests
  "expires_at": 1735689600           // Required: Unix timestamp when rule expires
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "rule_id": "api.example.com/users/[id,page]",
    "domain": "example.com",
    "subdomain": "api",
    "path": "/users",
    "query_params": ["id", "page"],
    "downstream_url": "http://backend:8080",
    "expires_at": 1735689600,
    "created_at": 1733270400,
    "updated_at": 1733270400
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Domain is mandatory"
}
```

---

### Get All Rules

**GET** `/api/rules`

Retrieve all routing rules (including expired).

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "rule_id": "api.example.com/users/[id,page]",
      "domain": "example.com",
      "subdomain": "api",
      "path": "/users",
      "query_params": ["id", "page"],
      "downstream_url": "http://backend:8080",
      "expires_at": 1735689600,
      "created_at": 1733270400,
      "updated_at": 1733270400
    }
  ],
  "count": 1
}
```

---

### Get Active Rules

**GET** `/api/rules/active`

Retrieve only non-expired routing rules.

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "rule_id": "api.example.com/users/[id,page]",
      "domain": "example.com",
      "subdomain": "api",
      "path": "/users",
      "query_params": ["id", "page"],
      "downstream_url": "http://backend:8080",
      "expires_at": 1735689600,
      "created_at": 1733270400,
      "updated_at": 1733270400
    }
  ],
  "count": 1
}
```

---

### Get Specific Rule

**GET** `/api/rules/:ruleId`

Retrieve a specific routing rule by ID.

**Parameters:**
- `ruleId` (path): URL-encoded rule ID

**Example:**
```bash
GET /api/rules/api.example.com%2Fusers%2F%5Bid%2Cpage%5D
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "rule_id": "api.example.com/users/[id,page]",
    "domain": "example.com",
    "subdomain": "api",
    "path": "/users",
    "query_params": ["id", "page"],
    "downstream_url": "http://backend:8080",
    "expires_at": 1735689600,
    "created_at": 1733270400,
    "updated_at": 1733270400
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Rule not found"
}
```

---

### Update Rule

**PATCH** `/api/rules/:ruleId`

Update a routing rule's downstream URL or expiry time.

**Request Body:**
```json
{
  "downstream_url": "http://new-backend:8080",  // Optional
  "expires_at": 1735776000                       // Optional
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "rule_id": "api.example.com/users/[id,page]",
    "domain": "example.com",
    "subdomain": "api",
    "path": "/users",
    "query_params": ["id", "page"],
    "downstream_url": "http://new-backend:8080",
    "expires_at": 1735776000,
    "created_at": 1733270400,
    "updated_at": 1733270500
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Rule not found"
}
```

---

### Delete Rule

**DELETE** `/api/rules/:ruleId`

Delete a routing rule.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Rule deleted successfully"
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Rule not found"
}
```

---

### Prune Expired Rules

**POST** `/api/rules/prune`

Manually trigger cleanup of expired rules.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pruned 5 expired rules"
}
```

---

### Route Matching (Internal)

**GET** `/api/match`

Used by Caddy to find matching routes. Query the database for a matching rule.

**Query Parameters:**
- `domain` (required): Domain name
- `subdomain` (optional): Subdomain
- `path` (optional): Request path
- Other query params are checked against allowed params

**Example:**
```bash
GET /api/match?domain=example.com&subdomain=api&path=/users&id=123&page=1
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "rule_id": "api.example.com/users/[id,page]",
    "domain": "example.com",
    "subdomain": "api",
    "path": "/users",
    "query_params": ["id", "page"],
    "downstream_url": "http://backend:8080",
    "expires_at": 1735689600,
    "created_at": 1733270400,
    "updated_at": 1733270400
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": "No matching rule found"
}
```

---

## cURL Examples

### Create a rule with specific query params
```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "subdomain": "api",
    "path": "/users",
    "query_params": ["id", "page", "limit"],
    "downstream_url": "http://backend:8080",
    "expires_at": 1735689600
  }'
```

### Create a wildcard rule
```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "subdomain": "*",
    "path": "*",
    "query_params": null,
    "downstream_url": "http://fallback:9000",
    "expires_at": 1735689600
  }'
```

### Get all active rules
```bash
curl http://localhost:3000/api/rules/active
```

### Update a rule
```bash
curl -X PATCH http://localhost:3000/api/rules/api.example.com%2Fusers%2F%5Bid%2Cpage%2Climit%5D \
  -H "Content-Type: application/json" \
  -d '{
    "downstream_url": "http://new-backend:8080",
    "expires_at": 1767225600
  }'
```

### Delete a rule
```bash
curl -X DELETE http://localhost:3000/api/rules/api.example.com%2Fusers%2F%5Bid%2Cpage%2Climit%5D
```

### Prune expired rules
```bash
curl -X POST http://localhost:3000/api/rules/prune
```

---

## Rule ID Format

Rule IDs are automatically generated in this format:

```
{subdomain}.{domain}/{path}/[{query_params}]
```

### Examples:

| Configuration | Rule ID |
|--------------|---------|
| subdomain: `api`, domain: `example.com`, path: `/users`, query_params: `["id", "page"]` | `api.example.com/users/[id,page]` |
| subdomain: `*`, domain: `example.com`, path: `*`, query_params: `null` | `*.example.com/*` |
| subdomain: `null`, domain: `example.com`, path: `/home`, query_params: `[]` | `!.example.com/home/[]` |
| subdomain: `www`, domain: `example.com`, path: `/test`, query_params: `null` | `www.example.com/test` |

---

## Timestamps

All timestamps are in **Unix epoch format** (seconds since January 1, 1970).

### Generate expiry timestamp (JavaScript):
```javascript
// 30 days from now
const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
```

### Generate expiry timestamp (Bash):
```bash
# 30 days from now
date -d "+30 days" +%s
```

---

## Error Codes

| Status Code | Description |
|------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (missing required fields) |
| 404 | Not Found (rule doesn't exist) |
| 500 | Internal Server Error |
