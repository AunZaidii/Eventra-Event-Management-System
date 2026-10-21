# Test Report: Eventra

- **Date:** 2026-10-21
- **Tested version:** commit `8e9762a` (Phase 3) running with `docker compose up --build` from an empty database
- **Environment:** Windows 11, Docker 29.8.2 / Compose v5.6, Node 24 (host), Node 22 + Nginx 1.27 + PostgreSQL 16 (containers), Chrome headless (UI tests)

## Summary

| Suite | How it runs | Passed | Failed | Not run |
|---|---|---|---|---|
| Backend unit + API tests (Jest + Supertest, real Postgres) | `cd backend && npm test` | **78** | 0 | 0 |
| API end-to-end through Nginx (docker compose stack) | `bash tests/e2e/api-e2e.sh` | **27** | 0 | 0 |
| Cloud-readiness checks (scaling, DB down, persistence) | manual commands, see §3 | **3** | 0 | 0 |
| Browser UI end-to-end (headless Chrome) | `cd tests/e2e && npm i && npm run ui` | **9** | **3** | 15 (blocked by Bug 1) |

Backend code coverage: statements 88.3% · branches 73.0% · functions 87.6% · lines 88.7%.

---

## 1. Passed

### Backend: Jest + Supertest (78/78), files in `backend/tests/`
- **Health (`health.test.js`, 6):** 200 + `db: "up"` when the DB works · **503 + `db: "down"` when the DB query fails** · health is not rate-limited · unknown route → 404 `ROUTE_NOT_FOUND` · invalid JSON → 400 `INVALID_JSON` · helmet security headers present, `X-Powered-By` hidden.
- **Event listing (`events.test.js`, 15):** only upcoming events, soonest first, with `registeredCount`/`seatsLeft` · empty list · filter by category · search title/location/description, case-insensitive · `%` and `_` searched literally · `from`/`to` date filters · empty filter values ignored · sort by most seats left · pagination · bad filters → 400 · full event shows `isSoldOut` · details by id · 404 missing · 400 non-numeric id · category list.
- **Registration (`registrations.test.js`, 14):** success returns an `EVT-XXXXXX` code, and the email is trimmed and lower-cased · 10 registrations get 10 different codes · **duplicate email → 409 `DUPLICATE_REGISTRATION`** · duplicate with different letter case → 409 · same email allowed for another event · **full event → 409 `EVENT_FULL`** · last seat then sold out · **10 people at once for 3 seats → exactly 3 succeed, no overbooking** · same email sent twice at once → one 201 + one 409 · invalid input → 400 with per-field errors · missing fields → 400 · unknown event → 404 · past event → 400 `EVENT_PAST` · extra fields ignored (a visitor can't set their own code).
- **Admin (`admin.test.js`, 36):** login returns a JWT (email case-insensitive) · wrong password 401 · unknown email gives the same 401 message · bad body 400 · password stored as bcrypt cost-12 hash · all 8 protected routes return 401 without a token · wrong-secret token rejected · expired token → `TOKEN_EXPIRED` · `/auth/me` · stats totals and per-event counts · create event (and it appears publicly) · optional banner · 7 invalid-input cases (past date, bad date, bad category, 0 / fractional capacity, short title, `javascript:` URL) · update · **capacity can't drop below registrations** · update / delete of missing event 404 · delete removes registrations too · admin list shows past events and filters by status · registrations list (newest first, search) · **CSV export** (headers, file name, quoting) · CSV with no rows · 404 for missing event.
- **Rate limits (`rateLimit.test.js`, 3):** 4th login attempt → 429 · 3rd registration → 429 · health check never limited.
- **Unit (`unit/utils.test.js`, 4):** code format with no look-alike characters · CSV quoting · CSV formula injection neutralised · UTF-8 BOM + CRLF.

### API end-to-end through Nginx (27/27), `tests/e2e/api-e2e.sh`
E1 homepage loads · E2 it is the React app · E3 JS bundle served · E4 hashed assets cached 1 year · E5 deep links (`/admin/events`) served by the SPA fallback · E6 Nginx CSP header · E7 `/api/health` through the proxy · E8 public list · E9 wrong password 401 · E10 admin login · **E11 admin creates an event** · E12 it appears publicly · **E13 visitor registers and gets a code** · E14 duplicate (other case) 409 · E15 last seat · E16 full event → `EVENT_FULL` · E17 sold out shown · E18 dashboard stats update · E19 CSV has header + 2 rows · E20 CSV file name through Nginx · E21 edit · E22 delete · E23 admin API needs a token · **E24 DB port 5432 not reachable from the host** · **E25 API port 4000 not reachable from the host** · E26 app container runs as user `node` · E27 `.env` not tracked by git.

### Cloud-readiness (3/3)
- **Stateless / load balancing:** scaled to 2 app containers (`docker compose up -d --scale app=2`). 20 admin requests with **one JWT** all returned 200 and were spread across both copies (app-1 and app-2 both served requests).
- **Health check for the load balancer:** with the `db` container stopped, `/api/health` returned **503 `{"status":"error","db":"down"}`**, and 200 again once it restarted.
- **Persistence:** after `docker compose restart`, all events were still there (named volume `pgdata`).

### Browser UI (9 passed), `tests/e2e/ui-test.js`
U1 home shows 8 event cards · U2 hero + "Next up" card · U3 "Sold out" overlay on a full event · U4 category chip filters the grid (8 → 2) · U5 empty state for a search with no results · U6 phone width (390px) has no horizontal scrolling · U7 phone menu button · U8 empty registration form shows 3 friendly field errors · U9 registration succeeds and the URL has the code (`EVT-TU858P`).

Visual check (screenshots of home desktop, home phone and event details): matches the approved design (cards, soft shadows, rounded corners, category badges, date tiles, seat bars, sold-out overlay).

---

## 2. Failed

| Test | Result |
|---|---|
| U10 confirmation page shows name, code and event | **FAILED**: blank page (Bug 1) |
| U11 success toast appears | **FAILED**: app crashed before the toast rendered (Bug 1) |
| U27 no JavaScript errors in the console | **FAILED**: `TypeError: n is not a function` (Bug 1) |
| U12–U26 (duplicate error in UI, sold-out page, admin login → dashboard, create/delete event in UI, registrations page, CSV button, phone dashboard, log out) | **NOT RUN**: blocked by Bug 1 |

---

## 3. Bugs found

### Bug 1 (critical): the app goes blank when moving between pages
- **What happened:** after clicking **Register now**, the page turned completely white instead of showing the confirmation ticket. The console shows `TypeError: n is not a function` (React, while cleaning up an effect). The same happens on **any in-app page change**: clicking an event card, admin sign-in going to the dashboard, the sidebar links. Pages only work when opened directly by URL or refreshed.
- **What should happen:** the confirmation page (and every other page) appears without reloading.
- **Cause (for the developer):** [frontend/src/App.jsx:23](../frontend/src/App.jsx#L23) has `useEffect(() => window.scrollTo(0, 0), [pathname]);`. The arrow function **returns** the value of `window.scrollTo()`. Current Chrome returns a Promise from `scrollTo`, so React stores it as the effect's "cleanup" and then tries to call it on the next route change. Fix: use a block body so nothing is returned, `useEffect(() => { window.scrollTo(0, 0); }, [pathname]);`.
- **Note:** the registration itself **is saved** (the server returns 201 and the code is in the URL). Only the page display breaks.
- **Steps to repeat:**
  1. `docker compose up --build -d`, then open http://localhost:8080 in Chrome.
  2. Click any event card, or open `/events/1` and fill in name, email and phone.
  3. Click **Register now**.
  4. The screen goes blank. Open DevTools → Console to see `TypeError: … is not a function`.

### Bug 2 (minor, layout): Search button wraps onto its own row on desktop
- **What happened:** at 1440px width, the hero search bar puts the **Search** button on a second line under the three fields (see screenshot `01-home-desktop`).
- **What should happen:** search text, category, date and the Search button sit on one row on desktop, as in the design, and stack only on small screens.
- **Steps to repeat:** open http://localhost:8080 on a desktop-width window and look at the search bar in the hero.

### Bug 3 (minor, UX): "Next up" hero card can promote a sold-out event
- **What happened:** the hero card shows the soonest event even when it's full. With the sample data it shows "Design Systems Masterclass" with **Seats left: 0**.
- **What should happen:** the hero should feature the soonest event that still has seats, or clearly label a sold-out one.
- **Steps to repeat:** start with sample data (`SEED_SAMPLE_DATA=true`) and open the homepage. The sample "Design Systems Masterclass" (capacity 3, 3 registrations) is the soonest event.

---

## 4. Spec success checks

| Success check (docs/spec.md §6) | Status |
|---|---|
| `docker compose up --build` starts web, app and db with no errors | ✅ |
| Homepage shows sample events | ✅ |
| Search and category/date filters change the list | ✅ (API + UI chip) |
| Visitor can register and sees a confirmation page with a code | ⚠️ API ✅ · **UI confirmation page broken (Bug 1)** |
| Duplicate email gives a friendly error | ✅ API · UI not verified (blocked) |
| Full event shows "Sold out" and can't be registered for | ✅ API + homepage badge · details page not verified in UI (blocked) |
| Admin can log in with the `.env` email/password | ✅ API · UI redirect to dashboard blocked by Bug 1 |
| Wrong password shows an error; too many attempts are blocked | ✅ |
| Dashboard shows correct totals and a chart | ✅ API · UI blocked |
| Admin can create, edit and delete an event | ✅ API · UI blocked |
| Admin can see registrations and download CSV | ✅ API · UI blocked |
| `/api/health` reports ok when the DB is up and an error when it's down | ✅ |
| Only web has an open port; DB not reachable from outside | ✅ |
| No secrets in code; `.env` not in git | ✅ |
| `npm test` in backend runs and all tests pass | ✅ 78/78 |
| Looks good on phone and desktop | ✅ public pages (minor Bug 2) · admin phone view blocked |
| CI workflow green on push | ⏳ Not verifiable from here (the repo is private; check the **Actions** tab on GitHub) |
| Deploy job skipped without AWS settings | ⏳ Same as above (the job has `if: vars.AWS_DEPLOY_ENABLED == 'true'`) |

---

## Result

**SOME FAILED**: 1 critical UI bug (blank screen on in-app navigation) and 2 minor UI issues. All backend, API, Docker and cloud-readiness checks pass.
