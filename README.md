# Eventra — Event Management System

A three-tier web application for publishing events and taking registrations, built for a university **Cloud Computing** project. It runs locally with one Docker command, and is ready for the cloud: stateless containers, a health-check endpoint for load balancers, configuration only through environment variables, and a GitHub Actions CI/CD pipeline that deploys to AWS.

| Visitors (no login) | Admin (JWT login) |
|---|---|
| Browse upcoming events, search, filter by category and date | Dashboard: totals, upcoming events, registrations-per-event chart |
| Event page with a registration form (name, email, phone) | Create, edit and delete events |
| No duplicate sign-ups per email; "Sold out" when full | View each event's registrations and export them as CSV |
| Confirmation page with a unique code (e.g. `EVT-7K3Q9P`) | Login rate limiting, bcrypt-hashed password |

UI design (clickable mockups): see [docs/design.md](docs/design.md) · Requirements: [docs/spec.md](docs/spec.md)

---

## Architecture (three tiers)

```
              ┌──────────────────────────── Docker network "backend" (private) ───────────────────────────┐
 Browser ───▶ │  WEB tier                      APP tier                         DB tier                   │
 :8080        │  Nginx                    ──▶  Node.js + Express REST API  ──▶  PostgreSQL 16             │
              │  • serves the React build      • validation, business rules     • data in named volume    │
              │  • /api/*  → reverse proxy     • JWT auth, stateless            • never exposed to host   │
              └────────────────────────────────────────────────────────────────────────────────────────────┘
```

In simple words:

1. **Web tier (presentation)**: what the user sees. React pages are compiled into plain HTML/CSS/JS files and served by **Nginx**. When the page calls `/api/...`, Nginx forwards the request to the app tier. This is called a *reverse proxy*. It's the **only** container with a port open to your computer.
2. **App tier (logic)**: a **Node.js + Express** REST API. It checks every input, applies the rules (no double registration, no overbooking), signs admin logins with JWT, and talks to the database. It keeps **no state** in memory or on disk, so you can run many copies behind a load balancer.
3. **Database tier (data)**: **PostgreSQL** stores admins, events and registrations. It's reachable only by the app tier, and its data lives in a Docker volume, so it survives restarts.

On AWS the same images run as: **Application Load Balancer** → **ECS Fargate** services (web + app) → **Amazon RDS PostgreSQL**.

---

## Run it locally (Docker)

**Requirements:** Docker Desktop (with Docker Compose v2).

```bash
# 1. Get the code
git clone https://github.com/AunZaidii/Event-Management-System.git
cd Event-Management-System

# 2. Create your settings file and edit the placeholder values
cp .env.example .env
#   - set DB_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD
#   - set JWT_SECRET to a long random string:
#       node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Build and start all three containers
docker compose up --build
```

Open **http://localhost:8080**. Sample events are loaded on the first start (`SEED_SAMPLE_DATA=true`).
Admin area: **http://localhost:8080/admin**. Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`.

Useful commands:

| Command | What it does |
|---|---|
| `docker compose ps` | Shows the 3 containers and their health |
| `docker compose logs -f app` | Follows the API logs |
| `docker compose exec db psql -U "$DB_USER" -d "$DB_NAME"` | Opens a SQL console inside the database container |
| `docker compose exec app npm run seed` | Loads sample events (only if there are none) |
| `docker compose down` | Stops everything (data is kept) |
| `docker compose down -v` | Stops everything **and deletes the database volume** |

Startup order is handled by health checks: `db` (pg_isready) → `app` (`/api/health`) → `web` (`/healthz`).
On start the API waits for the database, runs migrations (protected by a Postgres advisory lock, so several copies can start together safely), and creates or updates the admin account from the environment.

### Run without Docker (development)

```bash
# Terminal 1: API (needs a reachable PostgreSQL; settings come from .env or the shell)
cd backend && npm install && npm run dev        # http://localhost:4000

# Terminal 2: React dev server (proxies /api to localhost:4000)
cd frontend && npm install && npm run dev       # http://localhost:5173
```

---

## Environment variables

All configuration comes from environment variables. Nothing secret is in the code. `.env` is git-ignored; [.env.example](.env.example) lists every variable with a placeholder.

| Variable | Used by | Default | Description |
|---|---|---|---|
| `WEB_PORT` | compose | `8080` | Port on your computer for the website |
| `DB_HOST` | app | `db` | Database host name |
| `DB_PORT` | app | `5432` | Database port |
| `DB_NAME` | app, db | **required** | Database name |
| `DB_USER` | app, db | **required** | Database user |
| `DB_PASSWORD` | app, db | **required** | Database password |
| `DB_SSL` | app | `false` | `true` for managed databases such as Amazon RDS |
| `NODE_ENV` | app | `production` | `production` hides internal error details |
| `PORT` | app | `4000` | Port the API listens on inside its container |
| `JWT_SECRET` | app | **required** | Secret for signing admin tokens (minimum 32 characters) |
| `JWT_EXPIRES_IN` | app | `8h` | How long an admin login lasts |
| `CORS_ORIGIN` | app | *(empty)* | Comma-separated allowed origins, only if the API is called from another domain |
| `ADMIN_EMAIL` | app | **required** | Admin login email (account created or updated on start) |
| `ADMIN_PASSWORD` | app | **required** | Admin login password (stored as a bcrypt hash) |
| `SEED_SAMPLE_DATA` | app | `false` | `true` loads sample events when the events table is empty |
| `TRUST_PROXY` | app | `1` | Number of proxies in front of the API (for correct client IPs in rate limiting) |
| `RATE_LIMIT_LOGIN_MAX` | app | `10` | Login attempts per IP per 15 minutes |
| `RATE_LIMIT_REGISTER_MAX` | app | `20` | Registrations per IP per 10 minutes |
| `BACKEND_URL` | web | `http://app:4000` | Where Nginx forwards `/api` requests |

---

## API endpoints

Base path `/api`, JSON in and out. Every error has the same shape:
`{ "error": { "code": "EVENT_FULL", "message": "Sorry, this event is sold out.", "details": [ ... ] } }`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | – | Status of the app and the database connection: `200 {status:"ok", db:"up"}` or `503 {status:"error", db:"down"}` |
| GET | `/api/categories` | – | Fixed category list |
| GET | `/api/events` | – | Upcoming events. Query: `q`, `category`, `from`, `to` (YYYY-MM-DD), `sort` (`date`\|`seats`), `page`, `limit` |
| GET | `/api/events/:id` | – | One event with `seatsLeft`, `isSoldOut` |
| POST | `/api/events/:id/registrations` | – (rate-limited) | Register `{name, email, phone}`, returns `201 {code, registration, event}`. Errors: `409 DUPLICATE_REGISTRATION`, `409 EVENT_FULL`, `400 EVENT_PAST`, `400 VALIDATION_ERROR` |
| POST | `/api/auth/login` | – (rate-limited) | `{email, password}`, returns `{token, expiresAt, admin}` |
| GET | `/api/auth/me` | Bearer JWT | Current admin |
| GET | `/api/admin/stats` | Bearer JWT | Totals, registrations per event, next events |
| GET | `/api/admin/events` | Bearer JWT | All events. Query: `q`, `status` (`upcoming`\|`past`\|`soldout`), `page`, `limit` |
| POST | `/api/admin/events` | Bearer JWT | Create an event |
| GET | `/api/admin/events/:id` | Bearer JWT | One event |
| PUT | `/api/admin/events/:id` | Bearer JWT | Update an event (capacity can't go below current registrations) |
| DELETE | `/api/admin/events/:id` | Bearer JWT | Delete an event and its registrations (`204`) |
| GET | `/api/admin/events/:id/registrations` | Bearer JWT | Registrations. Query: `q`, `page`, `limit` |
| GET | `/api/admin/events/:id/registrations/export` | Bearer JWT | CSV download |

Event body: `{ "title", "description", "category", "startsAt" (ISO 8601), "location", "capacity", "bannerUrl" (optional) }`.
Categories: Conference, Workshop, Meetup, Concert, Sports, Webinar, Other.

---

## Tests

Backend tests use **Jest + Supertest** against a real PostgreSQL test database.

```bash
# Start a throwaway test database (no password, trust auth)
docker run -d --rm --name eventra-test-db -p 5433:5432 \
  -e POSTGRES_USER=eventra -e POSTGRES_DB=eventra_test -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:16-alpine

cd backend
DB_HOST=localhost DB_PORT=5433 DB_NAME=eventra_test DB_USER=eventra npm test
```

The test helpers refuse to run unless `DB_NAME` ends in `_test`, so tests can never wipe a real database. `npm test` is what the CI pipeline runs.

---

## CI/CD (GitHub Actions → AWS)

[.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml) runs on every push and pull request:

1. **Backend tests**: Postgres service container, then `npm test` with coverage.
2. **Frontend lint + build**: ESLint and a Vite production build.
3. **Docker images build**: builds both images to prove the Dockerfiles work.
4. **Deploy** (pushes to `main` only, after 1–3 pass): logs in to AWS with **OIDC** (no stored keys), pushes images to **Amazon ECR**, then rolls out new task definitions ([infra/aws](infra/aws)) to **ECS Fargate** and waits for the services to be stable.

The deploy job is **skipped** until the repository variable `AWS_DEPLOY_ENABLED` is `true`. The one-time AWS setup (ECR, ECS, ALB, RDS, Secrets Manager, IAM role and the GitHub variables) is described in [docs/deploy-plan.md](docs/deploy-plan.md).

---

## Project structure

```
backend/      Express API: src/{config, db, routes, controllers, services, middleware, validators, utils}, tests/
frontend/     React + Vite + Tailwind app: src/{pages, components, context, hooks, lib}, nginx/ config
infra/aws/    ECS Fargate task definition templates used by the pipeline
docs/         spec, design, test report, deploy plan
docker-compose.yml · .env.example · .github/workflows/ci-cd.yml
```

## Security notes

- Passwords hashed with bcrypt (cost 12). JWTs signed with HS256 and a required secret of 32+ characters.
- `helmet` security headers on the API, a strict CSP and security headers in Nginx, and a CORS allow-list.
- Rate limits on login (10 / 15 min) and registration (20 / 10 min) per client IP.
- Every endpoint validated with Zod. Parameterised SQL only. JSON body limited to 100 kB.
- Registrations use a row lock (`SELECT … FOR UPDATE`) plus a unique `(event_id, email)` constraint, so there's no overbooking and no duplicates, even with many app copies.
- CSV exports neutralise spreadsheet formulas (CSV injection).
- API container runs as a non-root user. The database is never published to the host.
