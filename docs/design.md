# Design: Eventra — Event Management System

This plan covers every feature in [spec.md](spec.md).
The visual mockups (all 10 screens, clickable) are on the design canvas: <https://claude.ai/artifact/PoLG6tHCmaPDA7adzFNkvq>

---

## 1. Architecture (three tiers)

```
                    ┌───────────────────────── Docker network (private) ─────────────────────────┐
 Browser ──HTTP──▶  │  WEB tier  (Nginx)          APP tier (Node + Express)      DB tier          │
  :8080             │  • serves React build  ──▶  • REST API on :4000      ──▶   PostgreSQL :5432 │
                    │  • /api/* → reverse proxy   • stateless, JWT auth          named volume     │
                    └─────────────────────────────────────────────────────────────────────────────┘
```

| Tier | What it does | Exposed to host? |
|---|---|---|
| **web** | Nginx serves the built React files and forwards every `/api/...` request to the app. | **Yes**, the only one (`WEB_PORT`, default 8080) |
| **app** | Express REST API: validation, business rules, auth, CSV export. Holds no state. | No (internal only) |
| **db** | PostgreSQL 16 with a named volume `pgdata`. | **No** |

**Why it is cloud-ready**
- **Stateless app:** no sessions, no files on disk. Login uses a signed JWT that the browser sends on each request, so any copy of the app can answer any request and the load balancer can spread traffic freely.
- **All config in environment variables**, so the same image runs locally, in CI and on AWS.
- **`/api/health`** checks the database, so the load balancer can take a broken copy out of rotation.
- **Migrations run automatically** when the app starts. A Postgres advisory lock means two copies starting at once never clash.

**On AWS (target for CD)**
```
Internet ─▶ Application Load Balancer ─┬─ /api/*  ─▶ ECS service "app" (Fargate, 2+ tasks) ─▶ RDS PostgreSQL
                                       └─ /*      ─▶ ECS service "web" (Fargate, 2+ tasks)
Images: Amazon ECR · Secrets: AWS Secrets Manager · Logs: CloudWatch
```
The ALB sends `/api/*` straight to the app service, and health-checks it on `/api/health`. The web image still contains the Nginx proxy, so it works the same locally.

---

## 2. Visual design system

**Look:** "calm, bold, modern". Light canvas, white cards, one strong indigo brand color, a warm ember accent used only for decoration, big grotesque display headings, generous rounded corners and soft layered shadows. No gradient washes, no emoji.

### Color tokens (become Tailwind `@theme` values)
| Token | Hex | Use |
|---|---|---|
| `ink` | `#0B1020` | Main text, dark panels (admin sidebar, hero "Next up" card, toasts) |
| `slate` | `#5B6475` | Secondary text (≥ 4.5:1 on white) |
| `line` | `#E6E8F0` | Borders, dividers |
| `canvas` | `#F6F7FB` | Page background |
| `surface` | `#FFFFFF` | Cards, inputs |
| `brand-600` | `#4F46E5` | Primary buttons, links, chart bars, progress bars |
| `brand-700` | `#4338CA` | Hover, accent text on soft fills |
| `brand-50` | `#EEF0FF` | Soft fills, focus ring `#E0E7FF` |
| `ember-500` | `#F97316` | Decorative shapes only (never text) |
| `ember-700` | `#C2410C` | "Only N seats left" text |
| `success` | `#15803D` | Confirmation, success toasts |
| `danger` | `#B91C1C` | Sold out, errors, delete |

**Category tints** (banner fallback and badges): Conference `#E0E7FF`/`#4338CA` · Workshop `#CCFBF1`/`#0F766E` · Meetup `#FEF3C7`/`#B45309` · Concert `#FCE7F3`/`#BE185D` · Sports `#DCFCE7`/`#15803D` · Webinar `#E0F2FE`/`#0369A1` · Other `#F1F5F9`/`#475569`.

### Typography
| Role | Font | Size / weight |
|---|---|---|
| Display (hero) | Bricolage Grotesque | `clamp(40px, 6vw, 68px)` / 800, tracking −0.035em |
| Headings | Bricolage Grotesque | 22–36px / 700 |
| Body | Inter | 16–18px / 400, line-height 1.5–1.7 |
| Labels, overlines | Inter | 12–14px / 600 (overlines uppercase, +0.08em) |
| Registration code | JetBrains Mono | 600, +0.12em |

### Shape, depth, motion
- **Radius:** inputs 12px · buttons 14px · cards 22px · hero/banner 28px · pills full.
- **Shadow:** rest `0 4px 16px -10px rgb(15 23 42 / .18)` · hover `0 22px 44px -16px rgb(15 23 42 / .22)` · modal `0 30px 60px -20px rgb(15 23 42 / .5)`.
- **Motion:** cards lift 4px on hover (200ms ease), buttons darken (150ms), skeleton shimmer while loading. All motion is off when the user's system has `prefers-reduced-motion` set.
- **Accessibility:** all text ≥ 4.5:1 contrast, every touch target ≥ 44px, visible focus ring, real `<button>`/`<a>`/`<label>`, `aria-live` toasts, status never shown by color alone (always a word: "Sold out").

### Responsive rules
- Max content width 1240px, 24px side padding (16px on phones).
- Event grid: `repeat(auto-fill, minmax(290px, 1fr))`, so 4 columns on wide screens, 1 on phones.
- Admin sidebar becomes a top bar with a menu button below 1024px. Tables scroll sideways inside their card.

### Shared components
`Navbar`, `Footer`, `EventCard`, `CategoryChips`, `SearchFilterBar`, `SeatsBar`, `Badge`, `Button` (primary / dark / secondary / danger / loading), `TextField`, `Select`, `Textarea`, `Modal` (`ConfirmDialog`), `Skeleton` cards, `EmptyState`, `ErrorState` (with Retry), `StatCard`, `RegistrationsChart`, `AdminLayout` (sidebar), `ProtectedRoute`, toasts via **Sonner**.

---

## 3. Screens

| # | Screen | Route | What's on it |
|---|---|---|---|
| 1 | **Home** | `/` | Sticky glass navbar; hero with headline, search bar (text + category + from-date + Search) and a dark "Next up" card for the soonest event; category chips; "Upcoming events" grid of cards (banner, category badge, date tile, title, date/time, location, seats bar and "N seats left" / "Only N left" / "Sold out" overlay); sort (soonest / most seats); skeletons while loading; empty state with "Clear filters"; error state with Retry; footer. |
| 2 | **Event details** | `/events/:id` | Back link; wide banner (image URL, or a category-tinted fallback if it's missing or broken); category badge, title, info tiles (date, time, location); description; **registration card** with seats bar and form (name, email, phone). Inline field errors; duplicate email shows an error under the email field plus a toast. Sold out shows a red badge, a disabled button, and "Browse other events". |
| 3 | **Confirmation** | `/events/:id/registered?code=…` | Green check, "You're in, {name}!", ticket card (event header, perforation, big mono code, name/email/phone/time), Copy code (clipboard + toast), Print ticket (`window.print`, print stylesheet), Back to events. Survives a page refresh because the code is in the URL and the event is fetched again. |
| 4 | **Phone layout** | — | The same pages stacked in one column: menu button, full-width search, sideways-scrolling chips, single-column cards. |
| 5 | **Admin login** | `/admin/login` | Split screen: dark brand panel and the sign-in form (email, password with show/hide). States: signing in…, wrong password, too many attempts (HTTP 429). |
| 6 | **Dashboard** | `/admin` | Stat cards: total events, total registrations, upcoming events, sold-out events. Horizontal bar chart "Registrations per event" (one indigo series, value labels, hover tooltip, "View as table" toggle). "Coming up next" list. |
| 7 | **Manage events** | `/admin/events` | Search, status filter (upcoming/past/sold out), table: thumbnail, title, category, location, date, status pill, seats bar, actions (registrations, edit, delete). Delete opens a confirm modal warning that registrations are deleted too. |
| 8 | **Create / edit event** | `/admin/events/new`, `/admin/events/:id/edit` | Form: title, category, location, description, date-and-time, capacity, banner URL. **Live preview** of the public card. Errors shown under each field (including "capacity below current registrations"). Save shows a toast and returns to the list. |
| 9 | **Registrations** | `/admin/registrations?event=:id` | Event picker, "registered / seats left" summary, search (name/email/code), table (avatar initials, name, email, phone, code, time), pagination, **Export CSV** button (download + toast). |
| 10 | **Not found** | `*` | Friendly 404 with a link home (same style as the empty state). |

---

## 4. User flows

**Visitor registers**
1. Opens `/`. Upcoming events load (skeletons show first).
2. Types a search or picks a category chip or from-date. The URL query updates (`?q=&category=&from=`), so filters survive refresh and can be shared.
3. Clicks a card and lands on `/events/:id`.
4. Fills name, email, phone. The browser checks the format first, then the server checks again.
5. Clicks **Register now**. The button shows a spinner.
   - **201:** goes to `/events/:id/registered?code=EVT-XXXXXX` with a success toast.
   - **409 `DUPLICATE_REGISTRATION`:** error under the email field plus a toast.
   - **409 `EVENT_FULL`:** the card switches to Sold out plus a toast ("someone took the last seat").
   - **400:** errors shown under each field.
   - **429:** toast "Too many attempts, please wait a minute".

**Admin manages events**
1. Opens `/admin`. Not logged in, so redirected to `/admin/login`.
2. Signs in. The JWT is saved in `localStorage` with its expiry, then the dashboard opens.
3. Events → **New event** → fills the form → **Create event**. A toast appears, the new event shows in the list and on the public homepage.
4. Edit or delete an event (delete asks for confirmation).
5. Registrations → picks an event → searches → **Export CSV** downloads `event-title-registrations.csv`.
6. Any `401` from the API (token expired or invalid) logs the admin out and shows the "Session expired" toast.

---

## 5. Data (PostgreSQL)

```sql
admins (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,      -- stored lower-case
  password_hash VARCHAR(255) NOT NULL,             -- bcrypt, cost 12
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
)

events (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  description TEXT         NOT NULL,
  category    VARCHAR(30)  NOT NULL CHECK (category IN ('Conference','Workshop','Meetup','Concert','Sports','Webinar','Other')),
  starts_at   TIMESTAMPTZ  NOT NULL,               -- stored in UTC
  location    VARCHAR(200) NOT NULL,
  capacity    INTEGER      NOT NULL CHECK (capacity > 0),
  banner_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)
INDEX events_starts_at_idx (starts_at), events_category_idx (category)

registrations (
  id         SERIAL PRIMARY KEY,
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL,                -- stored lower-case
  phone      VARCHAR(30)  NOT NULL,
  code       VARCHAR(12)  NOT NULL UNIQUE,         -- e.g. EVT-7K3Q9P
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, email)                         -- no duplicate sign-ups
)
INDEX registrations_event_id_idx (event_id)

schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())
```

**Business rules**
- **Seats left** = `capacity − COUNT(registrations)`, calculated in SQL every time and never stored, so it can't drift.
- **Safe registration:** done in one transaction that runs `SELECT … FROM events WHERE id=$1 FOR UPDATE`, counts registrations, rejects if full, then inserts. The row lock stops two people taking the last seat at the same time, even across several app copies. The `UNIQUE (event_id, email)` constraint is the final guard against duplicates (Postgres error `23505` → 409).
- **Registration code:** `EVT-` + 6 characters from an unambiguous alphabet (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`, no 0/O/1/I/L) using `crypto.randomInt`. Retries on the rare collision.
- **Past events** can't be registered for (400 `EVENT_PAST`) and are hidden from public lists.
- **Capacity edit** is rejected if it's lower than the current registration count (400 `CAPACITY_BELOW_REGISTRATIONS`).
- **Migrations:** plain numbered SQL files (`001_init.sql`, …). A small runner applies new ones inside a transaction and records them in `schema_migrations`.
- **Seeding:** the admin is created or updated from `ADMIN_EMAIL` / `ADMIN_PASSWORD` on every start, so changing the password env var takes effect. `npm run seed` loads 8 sample events with realistic future dates (and a couple of sample registrations, so one event is sold out). With `SEED_SAMPLE_DATA=true`, compose seeds automatically, but only when the events table is empty.

---

## 6. REST API

Base path `/api`. JSON in and out. Error shape for every failure:
```json
{ "error": { "code": "DUPLICATE_REGISTRATION", "message": "This email is already registered for this event.", "details": [ { "field": "email", "message": "..." } ] } }
```

| Method | Path | Auth | Purpose | Main responses |
|---|---|---|---|---|
| GET | `/api/health` | – | App + DB status (`SELECT 1`) | 200 `{status:"ok", db:"up", uptime, timestamp}` · 503 `{status:"error", db:"down"}` |
| GET | `/api/categories` | – | Fixed category list | 200 |
| GET | `/api/events` | – | Upcoming events. Query: `q`, `category`, `from`, `to` (ISO dates), `sort` (`date`\|`seats`), `page`, `limit` (≤ 50) | 200 `{items:[…with seatsLeft, registeredCount], page, limit, total}` |
| GET | `/api/events/:id` | – | One event with seats left | 200 · 404 |
| POST | `/api/events/:id/registrations` | – · rate-limited | Register `{name, email, phone}` | 201 `{code, registration, event}` · 400 · 404 · 409 `DUPLICATE_REGISTRATION` / `EVENT_FULL` · 429 |
| POST | `/api/auth/login` | – · rate-limited | `{email, password}` | 200 `{token, expiresIn, admin}` · 401 · 429 |
| GET | `/api/auth/me` | JWT | Who am I (token check) | 200 · 401 |
| GET | `/api/admin/stats` | JWT | Totals + registrations per event | 200 `{totalEvents, totalRegistrations, upcomingEvents, soldOutEvents, perEvent:[{id,title,registrations,capacity}]}` |
| GET | `/api/admin/events` | JWT | All events incl. past. Query: `q`, `status` (`upcoming`\|`past`\|`soldout`), `page`, `limit` | 200 |
| POST | `/api/admin/events` | JWT | Create | 201 · 400 |
| PUT | `/api/admin/events/:id` | JWT | Update | 200 · 400 · 404 |
| DELETE | `/api/admin/events/:id` | JWT | Delete (+ registrations) | 204 · 404 |
| GET | `/api/admin/events/:id/registrations` | JWT | List. Query: `q`, `page`, `limit` | 200 |
| GET | `/api/admin/events/:id/registrations/export` | JWT | CSV download (`Content-Disposition: attachment`) | 200 `text/csv` |

**Validation (Zod):** title 3–150, description 10–5000, category in list, `startsAt` valid ISO date (in the future when creating), location 2–200, capacity integer 1–100000, bannerUrl optional `http(s)` URL ≤ 2048; registration name 2–100, valid email ≤ 255 (trimmed and lower-cased), phone `^\+?[0-9\s\-()]{7,20}$`; ids are positive integers; unknown fields are stripped.

**CSV:** columns `Name, Email, Phone, Registration code, Registered at (UTC)`, UTF-8 with BOM so Excel opens it cleanly. Every field is quoted, and values that start with `= + - @` get a leading `'`, so a spreadsheet can't run a formula from them.

---

## 7. Security

| Concern | Measure |
|---|---|
| Passwords | bcrypt (`bcryptjs`, cost 12). Admin password comes only from env. |
| Auth | JWT HS256 signed with `JWT_SECRET` (startup fails if it's missing or under 32 chars), expiry `JWT_EXPIRES_IN` (default `8h`). Sent as `Authorization: Bearer`. |
| Headers | `helmet()` on the API, plus security headers in Nginx (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`). |
| CORS | Allow-list from `CORS_ORIGIN` (comma-separated). Same-origin through Nginx needs no CORS at all. |
| Rate limits | `express-rate-limit`: login 10 attempts / 15 min per IP; registration 20 / 10 min per IP; general API 300 / 15 min. `app.set('trust proxy', 1)` so the real client IP is used behind Nginx/ALB. Limits are counted per app copy, which is fine for this project; a shared Redis store can be added later. |
| Input | Zod validation on params, query and body; parameterised SQL only (no string-built queries); JSON body limit 100 kB. |
| Errors | Central handler: known `AppError`s return their code. Unknown errors return a generic 500 (no stack traces in production) and are logged. |
| Secrets | Nothing hardcoded. `.env` is git-ignored, `.env.example` has placeholders. On AWS, values come from Secrets Manager. |
| Containers | App runs as non-root `node` user. DB not published to the host. Images built from `node:22-alpine` / `nginx:1.27-alpine`. |

---

## 8. Folder plan (project root)

```
Event Management System/
├── backend/
│   ├── src/
│   │   ├── app.js                 # builds the Express app (used by server + tests)
│   │   ├── server.js              # migrate → seed admin → listen; graceful shutdown
│   │   ├── config/index.js        # reads + checks env vars
│   │   ├── db/
│   │   │   ├── pool.js            # pg Pool + query helper + transaction helper
│   │   │   ├── migrate.js         # migration runner (advisory lock)
│   │   │   ├── seed.js            # admin upsert + sample events (npm run seed)
│   │   │   └── migrations/001_init.sql
│   │   ├── routes/                # health, events, auth, admin  → index.js mounts all
│   │   ├── controllers/           # HTTP in/out only
│   │   ├── services/              # business logic + SQL (events, registrations, auth, stats)
│   │   ├── middleware/            # auth, validate, rateLimiters, errorHandler, notFound
│   │   ├── validators/            # Zod schemas
│   │   └── utils/                 # AppError, asyncHandler, registrationCode, csv
│   ├── tests/                     # Jest + Supertest (health, events, registrations, admin)
│   ├── jest.config.js
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore
├── frontend/
│   ├── src/
│   │   ├── main.jsx, App.jsx, index.css   # Tailwind + theme tokens
│   │   ├── api/client.js          # fetch wrapper, token, error mapping
│   │   ├── context/AuthContext.jsx
│   │   ├── components/            # ui/ (Button, Field, Modal, Skeleton…), events/, admin/, layout/
│   │   ├── pages/                 # Home, EventDetails, Confirmation, NotFound, admin/*
│   │   ├── hooks/                 # useFetch, useDebounce
│   │   └── lib/                   # format (dates in viewer's local time), categories
│   ├── public/favicon.svg
│   ├── index.html, vite.config.js, package.json
│   ├── nginx/default.conf.template  # SPA + /api proxy (backend URL from env)
│   ├── Dockerfile
│   └── .dockerignore
├── infra/aws/
│   ├── task-definition-app.json   # ECS Fargate task defs (secrets from Secrets Manager)
│   └── task-definition-web.json
├── .github/workflows/ci-cd.yml
├── docs/  spec.md · design.md · test-report.md · deploy-plan.md
├── docker-compose.yml
├── .env.example
├── .gitignore · .gitattributes (LF line endings for Docker/shell files)
└── README.md
```

---

## 9. Docker

- **backend/Dockerfile:** `node:22-alpine`. Install production deps with `npm ci --omit=dev`, copy `src`, `USER node`, `EXPOSE 4000`, `HEALTHCHECK` with wget on `/api/health`, `CMD ["node","src/server.js"]`.
- **frontend/Dockerfile:** stage 1 `node:22-alpine` runs `npm ci && npm run build`. Stage 2 `nginx:1.27-alpine` copies `dist/` and `default.conf.template`. The official image fills in `${BACKEND_URL}` (default `http://app:4000`) when it starts, so the same image works in compose and on ECS. Includes a `HEALTHCHECK`.
- **nginx config:** gzip on; long cache for hashed `/assets/*`, `no-cache` for `index.html`; `try_files $uri /index.html` for client routes; `location /api/ { proxy_pass ${BACKEND_URL}; … X-Forwarded-For/Proto }`; `/healthz` for the web container's own health.
- **docker-compose.yml:** services `db` (postgres:16-alpine, volume `pgdata`, `pg_isready` healthcheck, no `ports`), `app` (`depends_on: db: service_healthy`, no `ports`), `web` (`depends_on: app: service_healthy`, `ports: "${WEB_PORT:-8080}:80"`). Every value comes from `.env`.

---

## 10. CI/CD (GitHub Actions → AWS)

One workflow, `.github/workflows/ci-cd.yml`, triggered on push and pull request:

| Job | Runs when | Steps |
|---|---|---|
| `backend-test` | always | Postgres 16 service container → `npm ci` → `npm test` (Jest + Supertest, with coverage) |
| `frontend-build` | always | `npm ci` → `npm run lint` → `npm run build` |
| `docker-build` | after both pass | Build `backend` and `frontend` images with Buildx (layer cache). Builds only, no push. |
| `deploy` | push to `main` **and** repo variable `AWS_DEPLOY_ENABLED == 'true'` | OIDC login (`aws-actions/configure-aws-credentials`, role from `AWS_ROLE_ARN`) → ECR login → build and push `app` and `web` images tagged with the commit SHA → render the ECS task definitions with the new image → deploy both services and wait until they're stable. |

- Until the AWS variable is set, `deploy` shows as **skipped** (grey), not failed.
- Repo **variables:** `AWS_DEPLOY_ENABLED`, `AWS_REGION`, `ECR_REPO_APP`, `ECR_REPO_WEB`, `ECS_CLUSTER`, `ECS_SERVICE_APP`, `ECS_SERVICE_WEB`. Repo **secret:** `AWS_ROLE_ARN`. There are no AWS access keys anywhere.
- DB password, JWT secret and admin password live in **AWS Secrets Manager** and are injected into the ECS task.
- A `concurrency` group stops two deploys from running at the same time.

---

## 11. Testing plan

- **Backend (Jest + Supertest):** runs against a real Postgres test database (`DB_NAME=eventra_test`); migrations run once and tables are truncated between tests.
  - health: 200 with db up · 503 when the DB query fails (mocked)
  - events: list returns upcoming only, filters by category/date/search, details 404
  - registration: success returns a code in `EVT-XXXXXX` format · duplicate email (any letter case) → 409 · full event → 409 · invalid input → 400 · past event → 400
  - admin: login ok / wrong password 401 · protected routes need a token · create/update/delete event · capacity rule · CSV export headers and content
- **Frontend:** ESLint and production build in CI. Manual end-to-end checks in Phase 4 (site loads, admin creates an event, visitor registers, phone width).

---

## 12. Tech choices

| Tool | Why |
|---|---|
| **React 18 + Vite** | Fast dev server and small production build; the most popular React setup. |
| **Tailwind CSS v4** | Design tokens defined once (`@theme`), fast to build a consistent, responsive UI. |
| **React Router** | Client-side pages and protected admin routes. |
| **Recharts** | Simple, accessible React bar chart for the dashboard. |
| **Sonner** | Clean, modern toast notifications. |
| **lucide-react** | Consistent stroke icons that match the mockups. |
| **Node 22 + Express 4** | Simple, widely taught REST framework. |
| **pg (node-postgres)** | Plain SQL with parameters: easy to read and explain, no ORM magic. |
| **Zod** | One clear schema per endpoint for input validation. |
| **jsonwebtoken + bcryptjs** | Stateless auth; bcryptjs is pure JS, so there are no native build problems on Alpine. |
| **helmet, cors, express-rate-limit** | Standard Express security middleware. |
| **Jest + Supertest** | Tests the real HTTP API end to end; easy to run in CI. |
| **PostgreSQL 16** | Matches Amazon RDS; reliable constraints and row locks for seat counting. |
| **Nginx (alpine)** | Tiny, fast static server and reverse proxy. |
| **Docker Compose** | One command runs all three tiers locally. |
| **GitHub Actions + AWS ECR/ECS Fargate/ALB/RDS** | Free CI for public repos; managed, serverless containers behind a load balancer with a managed database. This is exactly the cloud setup the course asks for. |
