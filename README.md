# LAN-Media

A LAN-first multimedia communication platform built as a modular monolith. Phase 3 adds authenticated WebSocket presence and persisted realtime text chat on top of the Phase 2 MySQL and account foundation.

## Architecture and stack

- `backend/src`: Express REST API organized as Route → Controller → Service → Repository → MySQL, plus an authenticated `/ws` endpoint.
- `frontend/src`: React/TypeScript pages, hooks, REST API clients, shared WebSocket client, and CSS.
- `backend/src/core/database/migrations`: sequential migrations applied when the backend starts.
- `storage/`: reserved local file storage for a later phase.
- Node.js 22+, TypeScript, Express, `ws`, React, Vite, MySQL 8+, and mysql2.

The backend and frontend remain a single application. They are divided into modules that can be extracted later if needed. WebRTC calls, file transfer, LAN discovery, media streaming, and mobile are not implemented in this phase.

## Install and configure

1. Install Node.js 22+ and MySQL 8+ (or Docker Desktop for the optional Compose setup).
2. Copy `.env.example` to `.env` if needed.
3. Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in `.env`. Do not commit `.env`.
4. Create the database and application account using `docs/database/setup.sql`, or use the optional Compose setup below.
5. Install dependencies with `npm install`.

## Development

```sh
npm run dev
```

This starts the backend on `http://localhost:3000` and the Vite frontend on `http://localhost:5173`. The backend applies pending migrations at startup. Vite proxies `/api` and `/ws` to the backend. You can also start them separately with `npm run dev:backend` and `npm run dev:frontend`.

## API and realtime

Authentication uses an HttpOnly, SameSite=Lax session cookie; the database stores only its token hash. Passwords use Node's scrypt KDF. Production cookies are marked Secure and require HTTPS.

REST routes (all chat/user routes require authentication):

- `GET /api/health`
- `GET /api/users` and `GET /api/users/online`
- `GET /api/conversations`
- `POST /api/conversations/direct` with `{ "userId": "..." }`
- `POST /api/conversations/group` with `{ "name": "...", "memberIds": ["..."] }`
- `GET /api/conversations/:id/messages?limit=50&before=<ISO timestamp>`
- `POST /api/conversations/:id/members` and `DELETE /api/conversations/:id/members/:userId` (group admins)

WebSocket clients connect to `/ws`; the browser sends its session cookie automatically. Supported client events are `chat.send`, `chat.typing.start`, and `chat.typing.stop`. The server validates conversation membership, persists each message before broadcasting it, and sends `chat.message`, typing, presence, and structured error events. Multiple device connections are tracked per user; a user goes offline only after the last connection closes. Messages are text-only in this phase; `MAX_MESSAGE_LENGTH` defaults to 4000 characters.

## Database and Docker

Migration `001_initial_schema` creates the Phase 2 tables. `002_chat_schema` adds active-member state, group roles, conversation names, and message content while preserving prior rows. See `docs/database/README.md` for setup and inspection instructions.

Optional Docker setup:

```sh
docker compose up --build
```

Compose publishes MySQL at port 3307 by default. The Node container connects to the Compose database internally.

## LAN access

The backend and Vite bind to `0.0.0.0`. From another device on the same network open `http://<LAN-IP>:5173`; find the host IPv4 address with `ipconfig`. Vite proxies REST and WebSocket traffic through the frontend origin. Allow Node.js through the host firewall on the private network. Set `FRONTEND_ORIGIN` to the exact origin when accessing the API directly from another origin.

## Checks

```sh
npm run typecheck
npm run build
npm test
```

The integration tests use the configured MySQL database and skip database-backed checks if MySQL is unavailable. The chat integration covers authenticated WebSocket messaging, persistence/history, online status, direct conversations, group creation, admin authorization, and rejected anonymous WebSocket connections.

## Phase status

Phase 1 project setup, Phase 2 accounts and MySQL schema, and Phase 3 presence and realtime text chat are implemented. The next planned phase is file transfer and shared storage. Do not begin it automatically; Phase 3 should be reviewed first.
