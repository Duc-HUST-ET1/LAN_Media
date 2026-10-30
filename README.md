# LAN-Media

Phase 6 setup, API, and manual acceptance instructions: [docs/phase6.md](docs/phase6.md).

LAN-Media is a LAN-priority multimedia messaging application. The project currently includes registration/login, real-time chat over WebSocket, online status, one-to-one and group conversations, and file transfer. The application includes both backend and frontend in the same repository; MySQL stores accounts, login sessions, conversations, and messages. Uploaded files are stored on the server's local disk.

Voice and video calls can start even when the recipient is offline. An incoming call rings for 50 seconds; if unanswered, the server ends it automatically and notifies the connected parties that the call was missed.

> The instructions below use Windows PowerShell for file-copy commands and remain compatible with the current Docker Compose setup. Development can also be done on macOS/Linux with equivalent commands. Choose one of the two ways to run the app: Docker Compose (recommended for new machines) or Node.js + MySQL installed directly.

## Hardware requirements

The levels below are recommended configurations for small-scale testing and development, not benchmark results:

| Component | Minimum recommended | More comfortable |
|---|---:|---:|
| CPU | 2-core 64-bit | 4 cores or more |
| RAM, local runtime | 4 GB | 8 GB or more |
| RAM, Docker Desktop | 8 GB available for the machine and Docker | 16 GB or more |
| Disk | 5 GB free for cloning, installing dependencies, and running the database | SSD with extra free space for growing data/files |
| Network | Stable LAN/Wi‑Fi if accessed from other devices | Ethernet or Wi‑Fi on the same private network |

Upload sizes and database growth scale with usage; there is no hard total disk limit managed by the app. Each uploaded file defaults to a maximum of 100 MiB (`MAX_FILE_SIZE`).

## Technologies used

- **Backend:** Node.js 22+, TypeScript, Express 5, WebSocket (`ws`), MySQL 8+, and `mysql2`.
- **Frontend:** React 19, TypeScript, Vite 6.
- **Development tools:** npm, TypeScript, `concurrently`; tests use the Node.js test runner.
- **Environment packaging:** Docker Compose (optional), with Node.js 22 and MySQL 8.4.
- **Storage:** MySQL for application data; the `uploads/` directory on the server for file content.

## Default network ports

| Port | Service | Notes |
|---:|---|---|
| 3000 | Backend API and WebSocket | `PORT` |
| 5173 | Frontend Vite during development | `FRONTEND_PORT` |
| 3307 | MySQL published by Docker Compose | `MYSQL_PUBLISHED_PORT`; inside Docker, the app connects to MySQL on port 3306 |

Ports 3000 and 5173 must be allowed through the server firewall if access comes from other devices on the LAN. Only expose the minimum required ports on a trusted private network; do not expose the database to the internet.

## Method 1 — Clone and run with Docker Compose (recommended)

### 1. Install required tools

Install **Git** and **Docker Desktop** (enable Docker Compose/WSL 2 if Docker Desktop requires it). Launch Docker Desktop and wait for Docker to report readiness. This method does not require installing Node.js or MySQL directly on the machine.

### 2. Clone the repository

Open PowerShell in the folder where you want to store the project:

```powershell
git clone https://github.com/Duc-HUST-ET1/LAN_Media.git
cd LAN_Media
```

If the repository is moved to a different URL or is private, replace the clone URL with the GitHub URL shown in the repository and ensure your account has access.

### 3. Create and edit the environment file

Create `.env` from the template already in the repository:

```powershell
Copy-Item .env.example .env
notepad .env
```

Replace sample passwords with your own private values, at minimum:

```dotenv
DB_PASSWORD=your_private_app_password
DB_ROOT_PASSWORD=your_private_mysql_root_password
```

Do not use the sample values `change_me` or `change_root_me` in shared or production environments. Do not commit or share the `.env` file; it is already ignored by Git. Docker Compose creates the database and user based on `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `DB_ROOT_PASSWORD` when the MySQL volume is first initialized. If a MySQL volume already exists, changing `.env` does not automatically change the password already stored in the database.

### 4. Start the application

From the `LAN_Media` directory (where `docker-compose.yml` is located), run:

```powershell
docker compose up --build
```

On the first run, Docker downloads the images, installs npm packages inside the container, starts MySQL, and then runs the backend and frontend. Leave this window open while using the app. The backend automatically runs the database migrations at startup; no separate migration file is required.

Open the browser at <http://localhost:5173>. Check the backend at <http://localhost:3000/api/health>.

To stop it, press `Ctrl+C`. You can then run:

```powershell
docker compose down
```

This stops and removes the containers but keeps the data in the named volume. Do not use `docker compose down -v` if you want to keep the database.

## Method 2 — Run directly with Node.js and MySQL

Choose this if the machine already has MySQL and you want to run the app from the server terminal.

### 1. Install required tools

Install:

1. Git.
2. Node.js 22 or later (preferably the LTS release) — npm comes with Node.js.
3. MySQL Server 8 or later and the MySQL command-line client (`mysql`).

Verify the tools are available in PowerShell:

```powershell
node --version
npm --version
mysql --version
```

### 2. Clone the source code

```powershell
git clone https://github.com/Duc-HUST-ET1/LAN_Media.git
cd LAN_Media
```

### 3. Create the database and application account

Start the MySQL service, then run the initialization script with the MySQL admin account:

```powershell
Get-Content docs/database/setup.sql | mysql -u root -p
```

Enter the root password when prompted. The default script creates the `lan_media` database and the `lan_media_user` account with the password `change_me` for local development only. If you want different values, edit the database/user/password in `docs/database/setup.sql` before running it, then use the same values in `.env` in the next step. Do not use sample passwords on shared or production machines.

### 4. Create and configure `.env`

```powershell
Copy-Item .env.example .env
notepad .env
```

For a database running on the same machine, use matching connection values; for example, if you keep the default `docs/database/setup.sql`:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_NAME=lan_media
DB_USER=lan_media_user
DB_PASSWORD=change_me
```

`DB_PASSWORD` must match the password of the MySQL account created in step 3. If MySQL is running on another machine, set `DB_HOST` to that machine's address, allow MySQL connections from the app machine, and configure MySQL permissions/firewall appropriately; do not expose MySQL to the entire internet. `DB_ROOT_PASSWORD` and `MYSQL_PUBLISHED_PORT` are for Docker Compose only and are not needed for direct local execution.

Common variables to know:

| Variable | Default in `.env.example` | Meaning |
|---   |---                            |---      |
| `HOST`, `PORT` | `0.0.0.0`, `3000` | Backend bind address and port |
| `FRONTEND_PORT` | `5173` | Vite port; proxies `/api` and `/ws` to the backend |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Origin allowed by the backend; update if the frontend port/protocol changes |
| `DB_HOST`, `DB_PORT` | `localhost`, `3306` | MySQL address; in Compose, the backend uses the `mysql` hostname and port `3306` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | sample values | Database and application account; must match MySQL |
| `SESSION_TTL_HOURS` | `168` | Login session lifetime in hours |
| `MAX_MESSAGE_LENGTH` | `4000` | Maximum message length in characters |
| `UPLOAD_DIR` | `./uploads` | Directory where uploaded files are stored; must be writable |
| `MAX_FILE_SIZE` | `104857600` | Maximum file size in bytes (100 MiB) |
| `ALLOWED_FILE_TYPES` | `*` | Comma-separated MIME types/file extensions; `*` allows all |
| `VITE_ICE_SERVERS` | Google STUN default | ICE configuration in the frontend; STUN does not provide a TURN server |
| `VITE_HTTPS_KEY_FILE`, `VITE_HTTPS_CERT_FILE` | unset | Optional certificate/key paths to run Vite over HTTPS on the LAN |
| `DB_ROOT_PASSWORD`, `MYSQL_PUBLISHED_PORT` | sample values, `3307` | Root password and host port for MySQL when using Compose |

### 5. Install dependencies and run

In the project root:

```powershell
npm install
npm run dev
```

`npm run dev` starts both backend and frontend. The backend builds TypeScript, runs the server, and watches for changes; the frontend runs Vite. The backend runs migrations on startup, so ensure MySQL is running and the database variables are correct before launching the app.

Open <http://localhost:5173>. API health check: <http://localhost:3000/api/health>. Stop the app with `Ctrl+C`.

If you need to run them separately, open two PowerShell windows in the project directory:

```powershell
# Window 1: backend
npm run dev:backend
```

```powershell
# Window 2: frontend
npm run dev:frontend
```

## Access from other devices on the LAN

1. Connect the server and client devices to the same LAN/Wi‑Fi network.
2. On the Windows server, run `ipconfig` and find the IPv4 address of the active adapter (for example `192.168.1.20`).
3. Allow Node.js/Docker and ports `5173` (frontend) and `3000` (backend) through the Windows Firewall on the **Private network** profile.
4. Access the frontend from another device via `http://<server-ip>:5173`, for example `http://192.168.1.20:5173`.

The app's login, API, and WebSocket traffic are proxied to the backend by the frontend. If the browser needs camera/microphone access or other browser APIs that require a secure context, `http://<LAN-IP>` may not be enough. In that case, configure HTTPS for Vite with a trusted certificate on each device. Example on a Windows server with [mkcert](https://github.com/FiloSottile/mkcert) installed:

```powershell
mkcert -install
New-Item -ItemType Directory -Force certs
mkcert -key-file certs/lan-media-key.pem -cert-file certs/lan-media-cert.pem localhost 127.0.0.1 <server-ip>
```

Replace `<server-ip>` with the server's IPv4 address, then add the following to `.env`:

```dotenv
VITE_HTTPS_KEY_FILE=certs/lan-media-key.pem
VITE_HTTPS_CERT_FILE=certs/lan-media-cert.pem
FRONTEND_ORIGIN=https://<server-ip>:5173
```

Restart the app and open `https://<server-ip>:5173`. Client devices must trust the CA certificate produced by `mkcert -CAROOT`; running `mkcert -install` on the server does not automatically install the CA on phones or other machines. Only install a public CA certificate on devices that need access; keep the private CA key and server key secure and do not commit them. The certificate and key files under `certs/` are already ignored by Git. WebRTC features depend on browser support, secure context, and network/ICE configuration; the default STUN config does not guarantee calls across all routers/firewalls.

## Project checks

Run from the project root:

```powershell
npm run typecheck
npm run build
npm test
```

`npm test` builds the backend before running unit and integration tests. Some integration tests require MySQL with the configuration in `.env`; ensure the database is available if you want to validate database-dependent flows.

## Structure and related documentation

- `backend/src/` — API, services, repositories, migrations, and WebSocket server.
- `frontend/src/` — React UI, API client, and realtime client.
- `backend/src/core/database/migrations/` — migrations automatically run by the backend on startup.
- `docs/database/README.md` and `docs/database/setup.sql` — database setup guide and MySQL user creation script.
- `uploads/` — local upload storage; back it up separately if user files need preservation.
- `docker-compose.yml` — configuration for running the app and MySQL together via Docker Compose.

Advanced WebRTC/LAN discovery flows and mobile app support are not fully guaranteed just by following the steps above; check the current implementation state in the source before using them as production features.
