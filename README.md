# LAN-Media

A LAN-first multimedia communication platform. Phase 1 establishes a single modular application with a React web client and a Node.js HTTP API.

## Architecture

- `backend/src`: Express API organized around routes, controllers, services, and repositories, with core configuration and future module boundaries.
- `frontend/src`: React pages, reusable components, hooks, API client, and standalone CSS files.
- `storage/`: reserved local directories for future file storage.
- `tests/` and `docs/`: integration/unit/e2e test areas and project documentation.

The backend and frontend run as two development processes in one repository. This is a modular monolith; there are no microservices in Phase 1.

## Technology stack

Node.js 22+, TypeScript, Express, React, Vite, HTML, and CSS. MySQL, WebSocket, WebRTC, and file transfer are intentionally deferred.

## Requirements and installation

1. Install Node.js 22 or newer.
2. Copy `.env.example` to `.env` if you do not already have a local environment file.
3. Install dependencies:

   ```sh
   npm install
   ```

No credentials or secrets are required for Phase 1.

## Development commands

Run both backend and frontend together:

```sh
npm run dev
```

Or start either side separately:

```sh
npm run dev:backend
npm run dev:frontend
```

The frontend is at `http://localhost:5173`; the API listens at `http://localhost:3000` by default. The Vite development server proxies `/api` calls to the backend.

Typecheck, build, and run the health integration test:

```sh
npm run typecheck
npm run build
npm test
```

## Health endpoint

```sh
curl http://localhost:3000/api/health
```

Expected response:

```json
{"status":"ok","service":"LAN-Media Backend"}
```

The frontend home page also displays backend connection and API status.

## Access from another LAN device

The backend and Vite bind to `0.0.0.0`. Find the host computer's LAN IPv4 address (for example with `ipconfig` on Windows), then open:

- Frontend: `http://<LAN-IP>:5173`
- Backend health: `http://<LAN-IP>:3000/api/health`

Allow Node.js through the host firewall on the private network if prompted. The frontend uses a same-origin `/api` request and Vite proxies it to the backend, so client devices do not need to call their own `localhost`.

## Phase 1 status

Complete foundation: separate frontend/backend TypeScript configurations, LAN-bound development servers, health endpoint, JSON 404/error responses, basic startup logging, React placeholder pages, CSS structure, and frontend-to-backend health communication.

## Planned next phase

Phase 2 will introduce MySQL connectivity and the initial database schema/migrations. Authentication and other product modules remain out of scope until their planned phases.

`docker-compose.yml` is optional and not required for Phase 1 development; MySQL is not started by it.
