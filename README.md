# Смятанка

Math practice for a 3rd grade pupil at a Bulgarian school. Claude writes the problems in Bulgarian, with a Russian translation the child can open. The child's screen is in Bulgarian; the parent pages are in Russian. The app checks the answers and records how each attempt went. A parent sees statistics, sets which topics come up more often, and can ask Claude to analyze the results.

Stack: Nuxt 4, Nuxt UI 4, SQLite (better-sqlite3), Claude API (`@anthropic-ai/sdk`).

## Setup

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:3000
```

All variables are listed in `.env.example`. Nuxt reads `.env`; a direnv `.envrc` works only if direnv is active in the shell.

### Access

The child practices without signing in. Parents sign in (header link "Родител") to see statistics, change topic order, and skip problems. Parents are listed in `NUXT_PARENTS` as comma-separated `email:password` pairs (a password may contain `:` but not `,`). A sign-in lasts a year on that device until "Изход"; removing a parent from `NUXT_PARENTS` ends their sessions on the next request.

`NUXT_SESSION_PASSWORD` (32+ characters) encrypts the session cookie and must be set in production; in development Nuxt writes a random one into `.env` if it is missing. The cookie is not marked `Secure`, because the Pi serves plain http on the LAN; behind HTTPS set `NUXT_SESSION_COOKIE_SECURE=true`.

Keep the app on the home LAN or behind a VPN such as Tailscale: practice endpoints are open, and each new batch of problems costs API credits.

## Docker

One multi-stage `Dockerfile` (Node 24 Alpine) with a `dev` target and a `prod` target, wired up in `docker-compose.yml`:

```bash
docker compose up -d --build                       # production on :3000, database in the math-data volume
docker compose --profile dev up --build dev        # dev server with hot reload on :3001, source bind-mounted
```

- Secrets are never baked into an image (`.dockerignore` excludes `.env*` and `.envrc`). Compose takes `NUXT_ANTHROPIC_API_KEY`, `NUXT_PARENTS` and `NUXT_SESSION_PASSWORD` from the shell (e.g. direnv) or from `./.env`, and passes the rest of `./.env` as well.
- The production image contains only the built `.output`, runs as the `node` user, keeps SQLite in `/data`, and has a healthcheck.
- The dev container polls for file changes (`WATCH_POLLING=1`), because Docker on macOS does not deliver file events into bind mounts. Its database is `./data/math.sqlite` on the host, separate from the production volume.
- Back up the production database: `docker compose cp app:/data/math.sqlite ./math-backup.sqlite` (stop the app first, or also copy the `-wal` file).
- On the Raspberry Pi, build on the Pi itself, or cross-build with `docker buildx build --platform linux/arm64 --target prod -t math-training .`.

## Raspberry Pi deployment

`better-sqlite3` is a native module, so build on the Pi itself (64-bit OS, Node 22.9 or newer):

```bash
npm ci
npm run build
npm start              # reads .env, listens on PORT (default 3000)
```

Example systemd unit (`/etc/systemd/system/math-training.service`):

```ini
[Unit]
Description=Math training
After=network-online.target

[Service]
WorkingDirectory=/home/pi/math-training
ExecStart=/usr/bin/npm start
Restart=on-failure
User=pi

[Install]
WantedBy=multi-user.target
```

Everything lives in `data/math.sqlite`. Back up that file; the WAL mode files next to it are temporary.

## Install on a tablet (PWA)

The app is installable ("Смятанка" with its own icon, full screen, no browser bar). Browsers only allow
installing, and only run the service worker, on HTTPS or `localhost`. On plain `http://<pi>:3000`
the site works as before, but it is not installable as an app (iPad Safari can still add a home
screen shortcut via Share > Add to Home Screen).

To install it, put HTTPS in front of the Pi, for example Caddy with its internal CA
(`tls internal`, then trust Caddy's root certificate on the tablet) or Tailscale (`tailscale serve`),
and set `NUXT_SESSION_COOKIE_SECURE=true`.

The service worker caches only the built JS/CSS/fonts/icons for a fast start; every page and `/api`
request still goes to the server, so the app needs the Pi to be reachable. Icons are generated
from `public/icon.svg` with `npm run pwa-assets`.

## How it works

- **Problems** follow the style of the class workbook: mostly word problems, plus number riddles and "Намери неизвестното число" equations (a ± b = c). They are generated in batches of 8 per topic and stored in the database. Each answer comes with an arithmetic expression, and the server recomputes it. A problem whose stated answer doesn't match is discarded, so Claude's arithmetic mistakes never reach the child. A topic's pool is refilled in the background when a child has 3 or fewer unseen problems left in it.
- **Topic priority:** among N enabled topics, the one at the top is picked N times as often as the one at the bottom (linear weights). The parent changes the order on the topic page, or applies the order suggested by the AI analysis.
- **Metrics per attempt:**
  - Active solving time. It counts only while the tab is visible and the child has used the mouse or keyboard within the last minute.
  - The time at which each answer was solved.
  - Tries per answer, and the exact wrong numbers typed. These show misconceptions: 10 instead of 25 means "5 times more" was read as "5 more".
  - Whether the hint or the Russian translation was opened. Opening the translation points to a reading problem rather than a math problem.
  - Skipped, revealed or abandoned problems. A skipped (or abandoned) problem comes back after 3 other problems, marked as returning, until it is solved.
- **AI analysis** sends the per-topic statistics and recent wrong answers to Claude. It returns a summary, a verdict per topic, next steps, and a suggested order, in Russian.
