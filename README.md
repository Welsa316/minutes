# Minutes

Personal CRM + meeting notes for a freelance web developer. Vue 3 + Vite + Tailwind on the front, Express + Postgres on the back. Deploys as a single Railway service.

## Stack

- **Client** — Vue 3 (Composition API, `<script setup>`), Vite, Tailwind 3, Pinia, vue-router, Tiptap, vite-plugin-pwa
- **Server** — Express 4, pg (no ORM), bcryptjs, JWT in an httpOnly cookie
- **DB** — Postgres, plain `.sql` migrations applied by `server/migrate.js`

Workspaces are wired so `npm install` at the repo root installs both client and server.

## Local development

### 1. Prerequisites

- Node 20+
- Postgres 14+ running locally (or any reachable instance)
- Python 3 + Pillow (only needed if you want to regenerate the PWA icons; pre-generated ones are committed)

### 2. Install

```bash
git clone <this repo>
cd minutes
npm install
```

### 3. Configure env

```bash
cp .env.example .env
```

Edit `.env`:

- `DATABASE_URL` — point at your local Postgres
- `JWT_SECRET` — generate one: `openssl rand -base64 64`
- `ADMIN_USERNAME` — pick anything
- `ADMIN_PASSWORD_HASH` — generate from your plaintext password:
  ```bash
  npm run hash-password -- 'your-password-here'
  ```
  Copy the bcrypt string it prints into `.env`.

### 4. Create the database and run migrations

```bash
createdb minutes        # or use psql, pgAdmin, whatever
npm run migrate
```

You should see `+ 001_init.sql` and the migrations table populated.

### 5. Run the app

Two terminals:

```bash
# Terminal 1 — API on :3000
npm run dev:server

# Terminal 2 — Vite on :5173 (proxies /api to :3000)
npm run dev:client
```

Open `http://localhost:5173`. You'll be bounced to `/login`. Sign in with the username + plaintext password whose hash you put in `.env`.

### 6. (Optional) Regenerate PWA icons

```bash
pip3 install Pillow
npm run generate:icons
```

## Production build

```bash
npm run build         # builds client/dist
NODE_ENV=production npm start
```

In production the Express server serves `client/dist` as static files plus an SPA fallback, so the whole app runs on one port.

## Deploy to Railway

This repo is set up as a **single Railway service** that serves both API and the built client.

1. **Create a new Railway project**, then add a **Postgres** plugin.
2. **Create a service** pointing at this repo. Railway autodetects Node and reads `package.json`.
3. **Set environment variables** on the service:
   - `DATABASE_URL` — Railway's Postgres plugin exposes this; reference it with `${{Postgres.DATABASE_URL}}`
   - `PGSSL=true` — Railway Postgres requires SSL
   - `JWT_SECRET` — paste a long random value
   - `ADMIN_USERNAME` — your username
   - `ADMIN_PASSWORD_HASH` — run `npm run hash-password -- 'your-password'` locally and paste the result
   - `NODE_ENV=production`
   - `PORT` — Railway injects this automatically; the server respects it
4. **Build and start commands** (Railway should infer these from `package.json`, but set them explicitly if needed):
   - Build: `npm install && npm run build`
   - Start: `npm start`
5. **Run migrations**: open a Railway shell on the service and run `npm run migrate`. (You only need to do this once per migration file added.)
6. **Set the public domain** in Railway → service → Networking. Visit it, sign in, you're live.

The PWA manifest and service worker are produced at build time and served from `/`. HTTPS comes from Railway's domain, so installability works out of the box.

## Layout

```
/minutes
  /client                  Vite + Vue + Tailwind frontend
    /public                Static assets (PWA icons)
    /src
      /api                 axios instance
      /assets              global CSS (Tailwind layers + tokens)
      /components          Sidebar, TopNav, AppLayout, shared UI
      /router              vue-router config + guards
      /stores              Pinia (auth, ...)
      /views               One file per route
    generate-icons.py      Regenerate PWA icons
    vite.config.js
    tailwind.config.js
  /server                  Express API
    /db                    pg pool
    /middleware            auth, errorHandler
    /migrations            *.sql, applied by migrate.js
    /routes                auth, clients, projects, meetings, notes, action-items
    index.js               Server entrypoint
    migrate.js             Migration runner
    hash-password.js       bcrypt helper
  .env.example
  package.json             Workspaces root
```

## API surface

All `/api/*` routes except `/api/auth/login` and `/api/auth/me` require the auth cookie.

- `POST /api/auth/login` — `{ username, password }` → sets httpOnly cookie
- `POST /api/auth/logout` — clears cookie
- `GET  /api/auth/me` — current user or 401
- `GET|POST|PUT|DELETE /api/clients[/:id]`
- `GET|POST|PUT|DELETE /api/projects[/:id]`
- `GET|POST|PUT|DELETE /api/meetings[/:id]`
- `GET|POST|PUT|DELETE /api/notes[/:id]`
- `GET|POST|PUT|DELETE /api/action-items[/:id]`
- `PATCH /api/action-items/:id/toggle` — flips `done`

`GET` collections accept simple filter query params (e.g. `?status=active`, `?client_id=3`, `?upcoming=true`).
