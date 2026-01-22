# Fit Hub Leader Dashboard

Fit Hub is a Netlify-deployed leader dashboard for tracking weekly execution across three teams. It uses **Netlify Functions + Neon Postgres** for persistence and a single shared admin token for all access.

## Requirements

- Node.js 18+
- Netlify CLI (`npm install -g netlify-cli`)
- Neon Postgres database

## Environment Variables

Set these in Netlify (or in `.env` locally):

```
ADMIN_AUTH_TOKEN="ONE_SHARED_TOKEN_FOR_ALL_4_LEADERS"
DATABASE_URL="postgres://..."
# Optional pooler
DATABASE_URL_POOLER="postgres://..."
```

Every request must include the header:

```
x-admin-token: ONE_SHARED_TOKEN_FOR_ALL_4_LEADERS
```

## Run Locally

```bash
npm install
netlify dev
```

Visit `http://localhost:8888` (Netlify Dev default) and enter the shared token.

## Neon Setup

1. Create a Neon project and database.
2. Copy the connection string into `DATABASE_URL` (or `DATABASE_URL_POOLER` if you use the pooler).
3. Make sure the connection string uses SSL (Neon requires SSL). The functions connect with `ssl: { rejectUnauthorized: false }`.

## Database Migration

Run the migration once after setting env vars:

```bash
curl -X POST \
  -H "x-admin-token: ONE_SHARED_TOKEN_FOR_ALL_4_LEADERS" \
  http://localhost:8888/api/db-migrate
```

The migration SQL lives in `migrations/001_init.sql` and is idempotent.

## Local Dev Notes

- Functions live in `netlify/functions` and are reachable via `/api/<function-name>`.
- All endpoints require the `x-admin-token` header; there are no public reads.

## Export & Analyze Workflow

1. Click **Export Team History** or **Export All Teams History**.
2. The app copies JSON to your clipboard.
3. A new ChatGPT tab opens.
4. Paste the JSON into ChatGPT to analyze weekly trends.

## Token Rotation Process

1. Generate a new shared token.
2. Update `ADMIN_AUTH_TOKEN` in Netlify environment variables.
3. Notify all leaders to update their stored token (Settings → Clear Token → re-enter).
4. Optionally revoke old tokens by rotating again if needed.
