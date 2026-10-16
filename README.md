# Module 9 – Service Provider & Network Control
### Freight Management System (FMS) — Group 9 Capstone Deliverable

A complete, runnable implementation covering the four required features: **Service Network & Route Planner**, **Rate & Tariff Management**, **SOP Manager**, and **Schedules & Transit Timetable Management** — built as an independent, integration-ready subsystem.

**Stack:** Node.js + Express (backend) · MySQL (database) · Plain HTML/CSS/JS (frontend) · JWT auth with RBAC

> **New to this project? Don't read the whole README first.**
> - Setting this up on your own PC (Windows + VS Code)? → see **`SETUP_GUIDE.md`**
> - Want to run it in the browser with zero local installs (GitHub Codespaces)? → see **`CODESPACES_GUIDE.md`**

---

## 1. Folder Structure

```
freightsync/
├── README.md                      ← you are here
├── docs/                           ← all analysis & design deliverables
│   ├── 01-overview-requirements.md
│   ├── 02-use-cases-user-stories.md
│   ├── 03-workflow.md
│   ├── 04-database-design.md
│   ├── 05-api-design.md
│   ├── 06-ui-ux-dashboard-design.md
│   ├── 07-security-testing.md
│   └── 08-future-integration-plan.md
├── database/
│   ├── schema.sql                 ← full MySQL DDL (11 tables, FKs, indexes)
│   └── seed.sql                   ← sample data for local testing
├── backend/                        ← Express REST API
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   ├── config/db.js               ← MySQL connection pool
│   ├── middleware/
│   │   ├── auth.js                ← JWT authentication + RBAC
│   │   └── errorHandler.js
│   ├── controllers/                ← business logic per feature
│   │   ├── auth.controller.js
│   │   ├── routes.controller.js
│   │   ├── tariffs.controller.js
│   │   ├── sops.controller.js
│   │   ├── schedules.controller.js
│   │   ├── users.controller.js
│   │   └── auditLogs.controller.js
│   ├── routes/                     ← Express route definitions (→ /api/v1/...)
│   └── utils/                      ← response helpers, code generator, audit logger
└── frontend/                       ← plain HTML/CSS/JS UI
    ├── index.html                  ← login
    ├── dashboard.html               ← includes route-status & schedule-outcome charts
    ├── routes.html                  ← stop list supports drag-to-reorder
    ├── tariffs.html
    ├── sops.html
    ├── schedules.html
    ├── calendar.html                ← month-grid calendar view of schedules
    ├── settings.html                ← theme + custom color picker
    ├── css/style.css
    └── js/
        ├── api.js                   ← shared fetch client, auth, sidebar rendering
        ├── theme.js                 ← applies saved theme/colors before first paint
        ├── charts.js                ← dependency-free bar & donut chart helpers
        └── (one file per page)
```

## 2.1 Customization & Visualization Features

- **Settings page (`settings.html`)** — lets any user pick a light or dark base theme, plus their own accent and sidebar/brand colors via native color pickers or presets. Changes preview live across the open page immediately; "Save" persists them to that browser's `localStorage` so they apply automatically on every future visit from that device. "Reset to Default" restores the original navy/amber theme.
- **Calendar view (`calendar.html`)** — a month-grid view of all schedules, built on the `/schedules/calendar` endpoint that already existed in the API. Supports previous/next month navigation and click-through to a day's full schedule list.
- **Dashboard charts (`dashboard.html`)** — a horizontal bar chart of route status breakdown and a donut chart of schedule outcomes (Scheduled / In Transit / Completed / Delayed / Cancelled), built with a small dependency-free SVG/DOM chart helper (`js/charts.js`) rather than pulling in an external charting library, keeping the "plain HTML/CSS/JS, no build step" stack intact.
- **Drag-to-reorder stops (`routes.html`)** — the route create/edit modal's stop list now has a drag handle (⋮⋮) per row; dragging reorders stops, and the saved `sequence_no` for each stop is derived from the final row order.

## 2. Backend Architecture

**Layered / clean architecture**, one direction of dependency only:

```
routes/*.routes.js   →  controllers/*.controller.js  →  config/db.js (MySQL pool)
        ↓                          ↓
  middleware/auth.js         utils/audit.js, utils/response.js, utils/codeGenerator.js
```

- **routes/** — declares HTTP verbs + paths, attaches `authenticate`/`authorize` middleware, delegates to controllers. No business logic here.
- **controllers/** — all business logic: validation, transactions (e.g., tariff/SOP history snapshotting, route+stops creation), conflict detection.
- **middleware/** — cross-cutting concerns: JWT verification, role checks, centralized error translation.
- **utils/** — shared helpers: standardized `{success, data, meta}` responses, `RT-0001`-style code generation, and the `audit_logs` writer called from every state-changing controller action.
- **config/db.js** — a single `mysql2` connection pool (10 connections), imported everywhere data access is needed; no controller opens its own connection except where a transaction (`pool.getConnection()` + `beginTransaction`) is required.

## 3. Frontend Architecture

Plain HTML/CSS/JS, one page per feature, no build step required:

- **js/api.js** — shared across all pages: the `apiRequest()` fetch wrapper (attaches JWT, unwraps `{success,data}`, redirects to login on `401`), the `Auth` object (localStorage session), and `renderShell()` (draws the sidebar/topbar and hides nav/action buttons the current role can't use).
- Each page (`routes.html` + `js/routes.js`, etc.) is self-contained: fetch list → render table → open a modal for create/edit → call the API → re-fetch. No framework, no bundler — pages are opened directly or served by any static file server.
- Role-based UI: `hasRole(...)` in `api.js` reads the logged-in user's role from the JWT-derived session and conditionally renders action buttons — but this is a convenience layer only; the backend's `authorize()` middleware is the real enforcement (see `docs/07-security-testing.md §1`).

## 4. Setup Instructions

### Database
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

### Backend
```bash
cd backend
cp .env.example .env      # edit DB credentials + JWT_SECRET
npm install
npm run seed               # sets demo accounts' password to "Password123!"
npm run dev                 # or: npm start
# API now running at http://localhost:4000
```

### Frontend
No build step — serve the `frontend/` folder with any static server, e.g.:
```bash
cd frontend
npx serve .                 # or use the VS Code "Live Server" extension
```
Open the served URL (e.g. `http://localhost:5500`) in a browser. If your static server runs on a different port, update `CORS_ORIGIN` in `backend/.env` and `API_BASE` in `frontend/js/api.js` accordingly.

### Demo Logins (after `npm run seed`)
| Username | Role | Password |
|---|---|---|
| admin | System Administrator | Password123! |
| lmanager | Logistics Manager | Password123! |
| rplanner | Route Planner | Password123! |
| opscoord | Operations Coordinator | Password123! |
| spadmin1 | Service Provider Admin | Password123! |

## 5. Where Each Deliverable Lives

| # | Deliverable | Location |
|---|---|---|
| 1–4 | Overview, Scope, Functional & Non-Functional Requirements | `docs/01-overview-requirements.md` |
| 5–7 | Use Case Diagram, Use Case Descriptions, User Stories | `docs/02-use-cases-user-stories.md` |
| 8–9 | Business Process Flow, System Workflow | `docs/03-workflow.md` |
| 10–12 | ERD, Database Design, SQL Schema | `docs/04-database-design.md`, `database/schema.sql` |
| 13 | API Design | `docs/05-api-design.md` |
| 14–16 | Folder Structure, Backend Architecture, Frontend Architecture | this file, §1–3 |
| 17–18 | UI/UX Wireframe Descriptions, Dashboard Design | `docs/06-ui-ux-dashboard-design.md` |
| 19–20 | Security Design, Testing Plan | `docs/07-security-testing.md` |
| 21 | Future Integration Plan | `docs/08-future-integration-plan.md` |
| 22 | Complete Source Code | `backend/`, `frontend/`, `database/` |
