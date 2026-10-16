# Security Design & Testing Plan

## 1. Security Design

### Authentication
- Passwords hashed with **bcrypt** (10 salt rounds), never stored or logged in plaintext.
- **JWT** issued on login (`user_id`, `username`, `role`, `provider_id` in payload), expiring per `JWT_EXPIRES_IN` (default 8h).
- Every protected endpoint requires `Authorization: Bearer <token>`; missing/invalid/expired tokens return `401`.

### Authorization (RBAC)
- Role is embedded in the JWT and re-checked on the server for every request — the frontend hides buttons for roles that lack permission, but this is a UX convenience only; the middleware (`authorize(...)`) is the actual enforcement boundary, so a crafted request without proper role still gets `403`.
- Role matrix (also see `01-overview-requirements.md §3` and system RBAC table below):

| Endpoint group | Admin | Logistics Mgr | Route Planner | Ops Coordinator | Service Provider Admin |
|---|---|---|---|---|---|
| Routes: read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Routes: write/status | ✅ | ✅ | ✅ (write only) | ❌ | ❌ |
| Tariffs: read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tariffs: write/approve | ✅ | ✅ | ❌ | ❌ | ❌ |
| SOPs: read | ✅ | ✅ | ✅ | ✅ | ✅ |
| SOPs: author/submit | ✅ | ✅ | ✅ | ❌ | ❌ |
| SOPs: approve/publish | ✅ | ✅ | ❌ | ❌ | ❌ |
| Schedules: read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Schedules: create/update | ✅ | ✅ | ✅ | ❌ | ❌ |
| Schedules: status change | ✅ | ✅ | ❌ | ✅ | ❌ |
| Schedules: log delay | ✅ | ✅ | ❌ | ✅ | ✅ |
| Users / Audit Logs | ✅ | ❌ | ❌ | ❌ | ❌ |

### Data Validation & Integrity
- Required-field validation on every write endpoint before touching the database.
- Foreign-key constraints prevent orphaned records (e.g., a schedule cannot reference a non-existent route).
- `ER_DUP_ENTRY` and FK-violation MySQL error codes are translated into clean `409` API responses rather than leaking raw SQL errors.
- Route deletion is blocked while active/in-transit schedules reference it (referential business-rule integrity beyond what a plain FK constraint enforces).

### Auditability
- Every state-changing action (create/update/status change/approval/delay/login) writes an `audit_logs` row with actor, action, entity, and before/after JSON snapshots — visible only to Administrators via `/audit-logs`.

### Transport & Configuration
- CORS restricted via `CORS_ORIGIN` env var (defaults permissively for local dev only; must be locked to the deployed frontend origin in production).
- All secrets (`JWT_SECRET`, DB credentials) are environment-variable driven via `.env`, never committed or hard-coded.
- SQL access uses parameterized queries (`mysql2` placeholders) throughout — no string-concatenated SQL, eliminating the primary SQL-injection vector.

### Recommended Hardening for Production (beyond this capstone build)
- Rate limiting on `/auth/login` to slow credential-stuffing attempts.
- HTTPS termination (reverse proxy/load balancer) — the app itself is protocol-agnostic.
- Refresh-token rotation instead of a single long-lived JWT.
- Centralized secrets management (e.g., vault) instead of `.env` files in production.

---

## 2. Testing Plan

### 2.1 Unit-Level (per controller function)
| Area | Test Cases |
|---|---|
| Auth | valid login succeeds; wrong password rejected; inactive account rejected; missing token on protected route rejected |
| Routes | create with valid stops computes correct total distance; delete blocked when active schedules exist; status transition rejects invalid enum value |
| Tariffs | total_freight_cost computed correctly (base+fuel+additional); updating an Approved tariff writes a history row; invalid status transition rejected (e.g., Draft→Approved directly) |
| SOPs | editing a Published SOP increments version_number and archives a version snapshot; full-text search returns relevant rows; invalid status transition rejected |
| Schedules | overlapping vehicle time window returns 409 with conflicting schedule; non-overlapping windows succeed; delay logging updates status to Delayed and revises arrival time |

### 2.2 Integration-Level (API, via Postman/REST client or supertest)
- End-to-end tariff lifecycle: create (Draft) → submit → approve → verify `total_freight_cost` and history table state.
- End-to-end SOP lifecycle: create → submit → approve → publish → edit → confirm version_number incremented and prior version stored.
- Schedule conflict scenario: create schedule A for vehicle TRK-101 09:00–11:00; attempt schedule B for the same vehicle 10:00–12:00 → expect `409`.
- RBAC checks: attempt a Route Planner token against `POST /tariffs` → expect `403`; attempt an Ops Coordinator token against `POST /schedules` → expect `403`.

### 2.3 UI-Level (manual, per page)
- Login with each of the 5 demo roles; confirm sidebar/action buttons match the RBAC matrix above.
- Route creation with 3+ stops; confirm total distance auto-populates in the table after save.
- Tariff creation; confirm the live total preview matches the value shown in the table after save.
- Schedule creation that intentionally conflicts; confirm the toast names the conflicting schedule code.
- SOP search by category and by free-text query; confirm result sets narrow correctly.

### 2.4 Non-Functional
- Pagination: seed >20 routes/tariffs/schedules and confirm `meta.total` and page boundaries behave correctly.
- Load: basic smoke test with concurrent requests against `/routes` and `/schedules` to confirm the connection pool (limit 10) does not deadlock.
- Security: attempt SQL-injection-style input (e.g., `' OR 1=1` in a filter param) and confirm parameterized queries neutralize it.
