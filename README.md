# Caddy Dynamic Router

A dynamic reverse proxy system using Caddy with database-driven routing rules. Routes subdomains, paths, and query parameters to different downstream services with expiry dates and query parameter validation.

## Features

- **Dynamic Routing**: Routes based on subdomain, path, and query parameters
- **Database-Driven**: Uses SQLite for fast, low-footprint storage
- **Expiry Management**: Routes automatically expire with automated cleanup
- **Query Parameter Control**: Allow all, none, or specific query parameters
- **Intuitive Rule IDs**: Auto-generated IDs like `api.example.com/users/[id,page]`
- **RESTful API**: Fastify-based CRUD API for managing routes
- **Auto-Cleanup**: Cron job automatically prunes expired routes

## Rule ID Format

The system generates intuitive rule IDs based on your routing configuration:

- **Format**: `subdomain.domain/path/[query_params]`
- **Wildcard subdomain**: `*.example.com/api` (all subdomains)
- **No subdomain**: `!.example.com/api` (root domain only)
- **Wildcard path**: `api.example.com/*` (all paths)
- **No path**: `api.example.com/!` (root path only)
- **All query params**: `api.example.com/users` (query_params = null)
- **No query params**: `api.example.com/users/[]` (query_params = [])
- **Specific params**: `api.example.com/users/[id,page,limit]`

## Installation

```bash
npm install
```

## Configuration

Edit `.env` file:

```bash
API_HOST=0.0.0.0
API_PORT=3000
DB_PATH=./routing.db
CRON_SCHEDULE=0 * * * *  # Every hour
```

## Running the System

### Start the API Server
```bash
npm start
```

### Start the Cron Service
```bash
npm run cron
```

### Start Caddy
```bash
caddy run --config Caddyfile
```

## API Endpoints

### Create a Route
```bash
POST /api/rules
Content-Type: application/json

{
  "domain": "example.com",
  "subdomain": "api",           # or "*" for all, null/! for none
  "path": "/users",             # or "*" for all, null/! for none
  "query_params": ["id", "page"], # or null for all, [] for none
  "downstream_url": "http://backend-server:8080",
  "expires_at": 1735689600      # Unix timestamp
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rule_id": "api.example.com/users/[id,page]",
    "domain": "example.com",
    "subdomain": "api",
    "path": "/users",
    "query_params": ["id", "page"],
    "downstream_url": "http://backend-server:8080",
    "expires_at": 1735689600,
    "created_at": 1733270400,
    "updated_at": 1733270400
  }
}
```

### Get All Rules
```bash
GET /api/rules
```

### Get Active Rules (non-expired)
```bash
GET /api/rules/active
```

### Get Specific Rule
```bash
GET /api/rules/api.example.com%2Fusers%2F%5Bid%2Cpage%5D
```

### Update Rule
```bash
PATCH /api/rules/:ruleId
Content-Type: application/json

{
  "downstream_url": "http://new-backend:8080",
  "expires_at": 1735776000
}
```

### Delete Rule
```bash
DELETE /api/rules/:ruleId
```

### Manually Prune Expired Rules
```bash
POST /api/rules/prune
```

## Example Use Cases

### 1. Route all subdomains with specific path and query params
```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "subdomain": "*",
    "path": "/api/v1",
    "query_params": ["token", "format"],
    "downstream_url": "http://api-backend:3001",
    "expires_at": 1735689600
  }'
```
**Rule ID**: `*.example.com/api/v1/[token,format]`

### 2. Root domain with no path, all query params allowed
```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "subdomain": null,
    "path": null,
    "query_params": null,
    "downstream_url": "http://main-site:8080",
    "expires_at": 1735689600
  }'
```
**Rule ID**: `!.example.com/!`

### 3. Specific subdomain, wildcard path, no query params
```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "subdomain": "static",
    "path": "*",
    "query_params": [],
    "downstream_url": "http://cdn:9000",
    "expires_at": 1735689600
  }'
```
**Rule ID**: `static.example.com/*/[]`

### 4. API endpoint with specific query parameters
```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "myapp.com",
    "subdomain": "api",
    "path": "/users",
    "query_params": ["id", "page", "limit"],
    "downstream_url": "http://user-service:4000",
    "expires_at": 1767225600
  }'
```
**Rule ID**: `api.myapp.com/users/[id,page,limit]`

## Query Parameter Behavior

- **`null`**: All query parameters are allowed (not shown in rule_id)
- **`[]`**: No query parameters are allowed (shown as `/[]` in rule_id)
- **`["id", "page"]`**: Only specified parameters are allowed

## Database Schema

```sql
CREATE TABLE routing_rules (
  rule_id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  subdomain TEXT,
  path TEXT,
  query_params TEXT,
  downstream_url TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER,
  updated_at INTEGER
);
```

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Client    │─────▶│    Caddy     │─────▶│  Routing    │
│             │      │ Reverse Proxy│      │  API (3000) │
└─────────────┘      └──────────────┘      └─────────────┘
                            │                      │
                            │                      ▼
                            │               ┌─────────────┐
                            │               │   SQLite    │
                            │               │  Database   │
                            │               └─────────────┘
                            │                      ▲
                            ▼                      │
                     ┌─────────────┐              │
                     │ Downstream  │              │
                     │  Services   │       ┌──────────────┐
                     └─────────────┘       │ Cron Service │
                                           │ (Cleanup)    │
                                           └──────────────┘
```

## License

ISC
