# LAN-Media

A LAN-first multimedia communication platform built as a modular monolith. Phase 3 adds authenticated WebSocket presence and persisted realtime text chat on top of the Phase 2 MySQL and account foundation.

## Architecture and stack

- `backend/src`: Express REST API organized as Route → Controller → Service → Repository → MySQL, plus an authenticated `/ws` endpoint.
- `frontend/src`: React/TypeScript pages, hooks, REST API clients, shared WebSocket client, and CSS.
- `backend/src/core/database/migrations`: sequential migrations applied when the backend starts.
- `uploads/`: local file bytes, addressed by generated storage keys; `UPLOAD_DIR` can point to another writable directory.
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

WebSocket clients connect to `/ws`; the browser sends its session cookie automatically. Supported client events are `chat.send`, `chat.typing.start`, and `chat.typing.stop`. The server validates conversation membership, persists each message before broadcasting it, and sends `chat.message`, typing, presence, and structured error events. Multiple device connections are tracked per user; a user goes offline only after the last connection closes. Chat supports text and file messages. Files upload over authenticated HTTP and WebSocket messages carry metadata only.

File transfer endpoints:

- `POST /api/files/upload` with multipart field `file` and `X-Conversation-Id` header; authenticated conversation membership is required.
- `GET /api/files/:fileId/download`; authenticated active conversation membership is required.
- `GET /api/conversations/:conversationId/files`; returns file metadata shared in that conversation to active members.

`UPLOAD_DIR` defaults to `./uploads`, `MAX_FILE_SIZE` defaults to 104857600 bytes (100 MiB), and `ALLOWED_FILE_TYPES` accepts a comma separated list of MIME types/extensions or `*` (default). Downloads stream from disk. The UI reports browser upload progress through XHR and download progress while reading the HTTP response stream.

## Database and Docker

Migration `001_initial_schema` creates the Phase 2 tables. `002_chat_schema` adds active-member state, group roles, conversation names, and message content while preserving prior rows. `003_file_transfer_schema` adds FILE messages and links file metadata to conversations/messages without removing existing rows. See `docs/database/README.md` for setup and inspection instructions.

Optional Docker setup:

```sh
docker compose up --build
```

Compose publishes MySQL at port 3307 by default. The Node container connects to the Compose database internally.

## LAN access and browser calls

The backend and Vite bind to `0.0.0.0`. Find the host IPv4 address with `ipconfig`. Vite proxies REST and WebSocket traffic through the frontend origin. Allow Node.js through the host firewall on the private network.

Camera and microphone access requires a secure browser context. `http://localhost:5173` works on the host computer, but `http://<LAN-IP>:5173` is not secure on another device. For LAN calling, install [mkcert](https://github.com/FiloSottile/mkcert) on the host and run:

```powershell
mkcert -install
New-Item -ItemType Directory -Force certs
mkcert -key-file certs/lan-media-key.pem -cert-file certs/lan-media-cert.pem localhost 127.0.0.1 <LAN-IP>
```

Replace `<LAN-IP>` with the host IPv4 address. Configure these values in `.env`:

```dotenv
VITE_HTTPS_KEY_FILE=certs/lan-media-key.pem
VITE_HTTPS_CERT_FILE=certs/lan-media-cert.pem
```

Restart `npm run dev`, then open `https://<LAN-IP>:5173`. The mkcert root CA must also be trusted by each client device; `mkcert -install` trusts it only on the host. Export the CA certificate shown by `mkcert -CAROOT` and install/trust it on each phone or computer using that device's certificate settings, then reload the page. Keep the CA private key on the host and do not share it. The certificate and key files in `certs/` are ignored by Git.

## Checks

```sh
npm run typecheck
npm run build
npm test
```

The integration tests use the configured MySQL database and skip database-backed checks if MySQL is unavailable. The chat integration covers authenticated WebSocket messaging, persistence/history, online status, direct conversations, group creation, admin authorization, and rejected anonymous WebSocket connections.

## Phase status

Phase 1 project setup, Phase 2 accounts and MySQL schema, Phase 3 presence and realtime text chat, and Phase 4 LAN file transfer are implemented. WebRTC, LAN discovery and mobile functionality are outside this phase.
