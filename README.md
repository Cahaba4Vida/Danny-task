# Fit Hub Leader Dashboard

Fit Hub is a Netlify-deployed leader dashboard for tracking weekly execution across three teams. It uses **Netlify Functions + Netlify Blobs** for persistence and a single shared admin token for all access.

## Requirements

- Node.js 18+
- Netlify CLI (`npm install -g netlify-cli`)

## Environment Variables

Set the shared token in Netlify (or in `.env` locally):

```
ADMIN_AUTH_TOKEN="ONE_SHARED_TOKEN_FOR_ALL_4_LEADERS"
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

## Data Storage (Netlify Blobs)

Keys are organized by team and week:

- `roster/<teamId>.json`
- `weeks/<teamId>/<isoWeek>.json`
- `weeks-index/<teamId>.json`
- `audit/<teamId>/<isoWeek>.json`

Each week is stored independently using ISO weeks (YYYY-Www) and never overwritten.

## Token Rotation Process

1. Generate a new shared token.
2. Update `ADMIN_AUTH_TOKEN` in Netlify environment variables.
3. Notify all leaders to update their stored token (Settings → Clear Token → re-enter).
4. Optionally revoke old tokens by rotating again if needed.

## API Notes

All API endpoints require the `x-admin-token` header. Reads and writes are blocked without it.

Functions live in `netlify/functions` and are reachable via `/api/<function-name>`.
