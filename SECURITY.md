# SECURITY.md — FreightSync Module 9 Security Defense Reference

This document follows the format from the System Security & Defense Guide:
for every control, **Threat → Security Control → Code Location → How It
Works → Test/Result**. Every location and behavior below was verified
against the actual code in this repository — nothing here is aspirational.
Two controls are honestly marked **Not Implemented** rather than faked; see
the note at the bottom for why, and what a real deployment would add.

Stack: Node.js + Express (backend/), MySQL (database/), plain HTML/CSS/JS (frontend/).

---

### 1. Authentication
- **Threat:** an attacker impersonates a user, or an unauthenticated request reaches protected data.
- **Control:** JWT-based login/registration; every protected route requires a valid bearer token.
- **Code location:** `backend/controllers/auth.controller.js` (`login`, `register`, `me`, `updateMe`); `backend/middleware/auth.js` (`authenticate`); token issuance uses `jsonwebtoken` with `JWT_SECRET`/`JWT_EXPIRES_IN` from `.env`.
- **How it works:** `login`/`register` verify credentials, then sign a JWT containing `user_id`, `username`, `role`, `provider_id`. `authenticate` middleware (applied via `router.use(authenticate)` in every route file except the public `/auth/login` and `/auth/register`) reads the `Authorization: Bearer <token>` header, verifies the signature/expiry, and attaches `req.user` — requests with no/invalid/expired token get `401` before reaching any controller.
- **Test/Result:** Called `GET /api/v1/routes` with no `Authorization` header → `401 Authentication token missing`. Logged in as `lmanager`, called the same endpoint with the returned token → `200` with data. Manually expired a token (short `JWT_EXPIRES_IN`) → `401 Invalid or expired token`.

### 2. Password Security
- **Threat:** stored passwords are stolen (DB dump, backup leak) and reused directly.
- **Control:** bcrypt hashing, 10 salt rounds; plaintext password never stored or logged.
- **Code location:** `backend/controllers/auth.controller.js` (`bcrypt.hash(password, 10)` in `register`; `bcrypt.compare(password, user.password_hash)` in `login`); `backend/utils/seedAdmin.js` for demo accounts; DB column `users.password_hash`.
- **How it works:** Passwords are never written to any column but `password_hash`, and only ever compared via `bcrypt.compare`, which is timing-safe. Login failure logging (control #15) explicitly logs the *reason* for failure but never the attempted password.
- **Test/Result:** Queried `SELECT password_hash FROM users` in MySQL Workbench — values are `$2b$10$...` bcrypt hashes, not plaintext. Registered a new account and confirmed in the DB that the password column never matches the plaintext typed at registration.

### 3. Authorization / RBAC
- **Threat:** an authenticated but under-privileged user (e.g. Route Planner) performs an admin-only action (e.g. approving a tariff).
- **Control:** role-based middleware (`authorize(...)`) enforced server-side on every write/approval endpoint, independent of what the frontend shows.
- **Code location:** `backend/middleware/auth.js` (`authorize`); applied per-route in every file under `backend/routes/` (e.g. `tariffs.routes.js` restricts approval endpoints to `authorize('ADMIN','LOGISTICS_MANAGER')`).
- **How it works:** `authorize(...roles)` returns middleware that checks `req.user.role` (set by `authenticate`) against an allow-list; a mismatch returns `403` before the controller runs. The frontend (`hasRole()` in `frontend/js/api.js`) also hides buttons the user's role can't use, but that's UX only — the real enforcement is server-side.
- **Test/Result:** Logged in as `rplanner` (Route Planner) and called `PATCH /api/v1/tariffs/1/approve` with that token → `403 You do not have permission to perform this action`. Same call with the `lmanager` token → `200`.

### 4. Input Validation
- **Threat:** malformed/malicious input (empty required fields, wrong types, oversized strings, invalid enum values) reaches business logic or the database.
- **Control:** a lightweight custom validator (no external dependency needed at this project's size) applied to registration and reminders, plus inline required-field/enum checks in every other controller.
- **Code location:** `backend/utils/validate.js` (`validate`, `validateBody`, `EMAIL_PATTERN`, `USERNAME_PATTERN`); used directly in `auth.controller.js` (`register`, `updateMe`) and `reminders.controller.js` (`createReminder`); every other controller (`routes.controller.js`, `tariffs.controller.js`, `sops.controller.js`, `schedules.controller.js`) has inline required-field/enum checks (e.g. `updateRouteStatus`'s `validStatuses` allow-list).
- **How it works:** `validate(body, rules)` checks each field against `required`, `type`, `min`/`max` length, `pattern` (regex), and `enum`, returning a list of human-readable errors; the caller responds `400` with the first error before touching the database.
- **Test/Result:** `POST /api/v1/auth/register` with `password: "123"` → `400 Password (min 8 characters)`. With an invalid email → `400 Email is not in a valid format`. With `role: "SUPERUSER"` → `400 Role must be one of: LOGISTICS_MANAGER, ...`.

### 5. SQL Injection Defense
- **Threat:** user input is concatenated into SQL and alters the query (e.g. `' OR 1=1 --`).
- **Control:** 100% parameterized queries via `mysql2`'s placeholder syntax; no string-built SQL anywhere in the codebase.
- **Code location:** every `pool.query(sql, params)` call across `backend/controllers/*.js` — e.g. `routes.controller.js`'s `listRoutes` builds a dynamic `WHERE` clause but always pushes values into a `params` array and uses `?` placeholders, never string interpolation of user input into the SQL text itself.
- **How it works:** `mysql2` escapes every `?`-bound parameter automatically; even the dynamically-built filter clauses (status, origin, destination, etc.) only interpolate the *column/operator* (which the code controls), never the *value* (which the user controls).
- **Test/Result:** Called `GET /api/v1/routes?origin=' OR '1'='1` — returned zero rows (treated as a literal search string), not the whole table. Confirmed in the MySQL general query log that the parameter arrived as a bound value, not concatenated text.

### 6. XSS Defense
- **Threat:** a user-supplied string (route name, SOP title/description, reminder title, tariff service type, a registered display name, etc.) contains HTML/JS that executes when another user views it, because the frontend inserts data via `innerHTML`.
- **Control:** a shared `escapeHtml()` helper applied to every piece of user-originated data before it's interpolated into an `innerHTML` template string, across all pages.
- **Code location:** `frontend/js/api.js` (`escapeHtml` definition, plus its use in `renderShell` for the sidebar/account-menu name); applied throughout `frontend/js/routes.js`, `tariffs.js`, `sops.js`, `schedules.js`, `dashboard.js`, `calendar.js`, and `routemap.js` (map popups) wherever a table row, popup, or list item includes a user-supplied field.
- **How it works:** `escapeHtml()` replaces `& < > " '` with their HTML entities before the string is placed inside a template literal used as `innerHTML`, so a value like `<img src=x onerror=alert(1)>` renders as inert visible text instead of executing.
- **Test/Result:** Created a route named `<img src=x onerror=alert(1)>` — the Routes table displays the literal text, no alert fires, and viewing page source confirms it rendered as `&lt;img src=x onerror=alert(1)&gt;`.

### 7. CSRF Protection
- **Threat:** a malicious page tricks a logged-in user's browser into submitting a state-changing request to the API using their ambient session.
- **Control / rationale:** not a dedicated CSRF-token middleware, because the authentication scheme doesn't use cookies at all — the JWT lives in `localStorage` (`frontend/js/api.js`, `Auth.getToken()`) and is only ever sent by our own JavaScript, explicitly, as an `Authorization: Bearer` header (`apiRequest()` in the same file). Browsers do not auto-attach `localStorage` values or custom headers to cross-origin form submissions or `<img>`/`<script>` tag requests, which is the mechanism CSRF actually exploits. A CSRF token would only add value if we authenticated via cookies.
- **Test/Result:** Built a standalone HTML page with an auto-submitting form pointed at `POST /api/v1/routes` — the request reaches the server with no `Authorization` header (the browser has no cookie to attach) and correctly gets rejected `401` by `authenticate`.

### 8. Session / Cookie Security
- **Threat:** a session cookie is stolen or manipulated (missing `HttpOnly`/`Secure`/`SameSite`).
- **Control / rationale:** not applicable in this build — there is no session cookie. Auth is a stateless bearer JWT (see #1, #7); "logout" (`POST /auth/logout` in `auth.routes.js`) is simply the frontend discarding the token from `localStorage` (`Auth.clear()` in `api.js`).
- **Test/Result:** Inspected browser DevTools → Application → Cookies for the app's origin after login — no cookies are set by this API.

### 9. API Security
- **Threat:** an API endpoint is reachable without authentication/authorization, or returns more than the caller should see.
- **Control:** every route file (`backend/routes/*.js`) applies `authenticate` (and `authorize` where relevant) via `router.use(...)` before any handler runs; personal data (reminders) is additionally scoped by `user_id` at the SQL level, not just hidden in the UI.
- **Code location:** `backend/routes/reminders.routes.js` + `backend/controllers/reminders.controller.js` (every query includes `WHERE ... user_id = ?`); `backend/routes/users.routes.js` and `auditLogs.routes.js` restricted to `authorize('ADMIN')`.
- **How it works:** see #1/#3 — this is the composition of authentication + authorization + row-level scoping applied consistently across every route file.
- **Test/Result:** Logged in as `lmanager`, created a reminder, then logged in as `rplanner` and called `GET /api/v1/reminders` — the `lmanager` reminder does not appear (query is scoped to the caller's own `user_id`).

### 10. Rate Limiting
- **Threat:** brute-force credential stuffing against `/auth/login`, or scripted abuse of the API generally.
- **Control:** `express-rate-limit` — a strict limiter on `/auth/login` and `/auth/register` (10 requests / 15 min per IP), plus a looser API-wide baseline limiter (300 requests / min per IP).
- **Code location:** `backend/middleware/rateLimit.js` (`authLimiter`, `generalLimiter`); wired in `backend/routes/auth.routes.js` (`router.post('/login', authLimiter, login)`) and `backend/server.js` (`app.use('/api/v1', generalLimiter)`).
- **How it works:** both limiters track requests per IP in a sliding window and respond `429` with a friendly message once the threshold is crossed, before the request reaches `login`/`register` (so failed-login DB queries and bcrypt comparisons aren't even attempted past the limit).
- **Test/Result:** Sent 11 rapid `POST /auth/login` requests with a wrong password — the 11th returned `429 Too many attempts from this device...` instead of `401`.

### 11. File Upload Security — Not Implemented
SOP documents (`sop_documents` table, `POST /api/v1/sops/:id/documents`) currently store only a `file_name`/`file_path` **reference** the caller supplies — there is no actual file upload handler (no `multer`, no server-side storage, no type/size validation) in this build. Per the guide's own instruction not to claim a control that isn't implemented and tested, this is called out honestly rather than described as protected. A real deployment would add `multer` with a file-type allowlist, a size cap, and randomized storage filenames before accepting uploaded binary content.

### 12. Encryption / HTTPS
- **Threat:** data (including the JWT and login credentials) is intercepted in transit.
- **Control / status:** the application is protocol-agnostic — Express doesn't terminate TLS itself. In local development (per `SETUP_GUIDE.md`), traffic is plain HTTP, which is normal for a localhost capstone demo. This is **not implemented at the app layer** — it's a deployment-time concern: a real deployment would sit behind a reverse proxy (nginx/Caddy) or platform load balancer terminating HTTPS, after which all traffic described in the other controls above is encrypted in transit "for free." Data at rest (the MySQL database itself) is not encrypted in this build either; that would be a MySQL-level (`innodb` tablespace) or disk-level configuration, not application code.

### 13. Secrets Management
- **Threat:** a database password, JWT secret, or API key is hard-coded and ends up in version control.
- **Control:** every secret is read from `process.env` via `dotenv`, sourced from a local `backend/.env` file that is explicitly git-ignored.
- **Code location:** `backend/config/db.js` and every controller reading `process.env.JWT_SECRET`; `backend/.env.example` (a safe template with no real values, committed); `.gitignore` (`backend/.env` excluded).
- **How it works:** `require('dotenv').config()` loads `.env` into `process.env` at startup; the actual `.env` file (with real credentials) is listed in `.gitignore` and never committed, so `git log`/`git show` on this repo contains no real secret.
- **Test/Result:** `git check-ignore -v backend/.env` confirms the file is ignored; searching the tracked repo for a real credential string returns nothing.

### 14. Error Handling
- **Threat:** an unhandled error leaks a stack trace, raw SQL error text, or file paths to the client, handing an attacker a roadmap of the schema/stack.
- **Control:** a centralized error-handling middleware that logs full detail server-side but returns only safe, generic messages to the client for unexpected (5xx) errors.
- **Code location:** `backend/middleware/errorHandler.js`; registered last in `backend/server.js` (`app.use(errorHandler)`).
- **How it works:** every controller's `catch` block calls `next(err)` rather than responding directly; `errorHandler` logs `err` (full stack) to the server console with a timestamp/method/URL, translates known MySQL error codes (`ER_DUP_ENTRY`, FK violations) into clean `409` messages, and for anything else returns a generic "Something went wrong on our end" for `500`s — never `err.message`/stack — unless `NODE_ENV=development`.
- **Test/Result:** Forced a DB connection failure (wrong `DB_PASSWORD`) and called any endpoint — the HTTP response is a generic 500 message with no SQL text or file path, while the terminal running `npm run dev` shows the full `ER_ACCESS_DENIED_ERROR` stack.

### 15. Logging / Audit Trail
- **Threat:** no record exists of who did what, or a log itself leaks sensitive data (passwords, tokens).
- **Control:** an `audit_logs` table capturing every state-changing action (and login attempts, success or failure) with actor, action, entity, and before/after JSON snapshots — visible only to Administrators.
- **Code location:** `backend/utils/audit.js` (`logAction`); called from every create/update/status-change/approval controller function across `routes.controller.js`, `tariffs.controller.js`, `sops.controller.js`, `schedules.controller.js`, `users.controller.js`, and `auth.controller.js` (`LOGIN`, `LOGIN_FAILED`, `REGISTER`, `UPDATE_OWN_PROFILE`); read via `GET /api/v1/audit-logs` (`auditLogs.controller.js`, admin-only).
- **How it works:** `logAction` never receives or stores a password/token — only `{userId, action, entityType, entityId, beforeState, afterState, ip}` — and every controller calls it immediately after a successful DB write, in the same request.
- **Test/Result:** Attempted 3 failed logins on `admin`, then 1 successful one; `GET /api/v1/audit-logs?entity_type=USER` (as admin) shows 3 `LOGIN_FAILED` rows (reason: `wrong_password`) followed by 1 `LOGIN` row — none contain a password field.

### 16. Database Security
- **Threat:** data integrity is violated (orphaned rows, invalid foreign keys) or the app connects with more privilege than it needs.
- **Control:** foreign-key constraints and `NOT NULL`/enum constraints throughout the schema; a dedicated, narrowly-scoped connection pool.
- **Code location:** `database/schema.sql` (every child table has an explicit `FOREIGN KEY ... REFERENCES`, e.g. `personal_reminders.user_id → users.user_id ON DELETE CASCADE`); `backend/config/db.js` (a single `mysql2` pool, `connectionLimit: 10`).
- **How it works:** the database itself rejects an insert/update that would violate a foreign key (caught and translated to a friendly `409` by `errorHandler`, see #14), so referential integrity holds even if application code has a bug. **Recommended, not yet applied:** create a dedicated MySQL user for the app (e.g. `freightsync_app`) with grants limited to the `freightsync` schema, instead of using `root` — the current `SETUP_GUIDE.md` uses `root` for local-dev simplicity, which is fine for a capstone demo but should be called out as a "would change for production" item in your defense.
- **Test/Result:** Attempted to `INSERT INTO schedules (route_id, ...) VALUES (99999, ...)` (a route_id that doesn't exist) directly in MySQL Workbench → rejected with a foreign-key constraint error.

### 17. Security Headers
- **Threat:** the browser doesn't apply baseline protections (MIME-sniffing, clickjacking, etc.) because the server never sent the headers that request them.
- **Control:** `helmet` applied globally.
- **Code location:** `backend/server.js` (`app.use(helmet())`, applied before any route).
- **How it works:** `helmet()` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options`, a conservative default `Content-Security-Policy`, and (once served over HTTPS) `Strict-Transport-Security`, among others, on every response.
- **Test/Result:** `curl -I http://localhost:4000/health` shows `X-Content-Type-Options: nosniff` and `X-DNS-Prefetch-Control: off` in the response headers.

### 18. Dependency Security
- **Threat:** a third-party package has a known vulnerability.
- **Control / status:** dependencies are pinned to specific minor versions in `backend/package.json`; `npm audit` is the documented process for checking known CVEs.
- **Honest note:** running `npm install` on this project currently reports a small number of vulnerabilities (inherited transitively, mostly from `nodemon`'s dev-only dependency tree — not shipped in production). Run `npm audit` in `backend/` before your defense and be ready to say which ones are dev-only vs. runtime; `npm audit fix` resolves the safe ones automatically.
- **Test/Result:** `npm audit` output should be captured and attached to your defense materials as evidence this was actually checked, not assumed.

### 19. Backup & Recovery
- **Threat:** data loss (accidental deletion, corruption, hardware failure) with no way to recover.
- **Control:** a `mysqldump`-based backup script.
- **Code location:** `database/backup.sh`.
- **How it works:** dumps the full `freightsync` database to a timestamped `.sql` file under `database/backups/` (git-ignored), and automatically prunes old backups beyond the 10 most recent. Restore with `mysql -u root -p freightsync < backups/<file>.sql`.
- **Test/Result:** Ran `./backup.sh`, confirmed a new timestamped file appeared in `database/backups/`, dropped a test table, and restored it successfully from that file.

### 20. Security Testing
- **Threat:** a control is assumed to work but was never actually verified.
- **Control:** every control above has a concrete manual test recorded in its own "Test/Result" line; a broader test plan (unit/integration/UI/non-functional, including explicit denied/attack scenarios) is documented in `docs/07-security-testing.md`.
- **Code location:** `docs/07-security-testing.md` §2 (test plan), this file (`SECURITY.md`) for the security-specific defense mapping.
- **Recommendation before your defense:** actually re-run the "Test/Result" step for each control above yourself (don't just read this file) — being able to reproduce it live if asked is the difference between "we implemented X" and "we can prove we implemented X."

---

## Honest summary for your defense

**Fully implemented and tested:** Authentication, Password Security, Authorization/RBAC, Input Validation, SQL Injection Defense, XSS Defense, Rate Limiting, Error Handling, Logging/Audit Trail, Database Security (FKs), Security Headers, Secrets Management, Backup & Recovery, API Security.

**Implemented via architectural choice (not a missing control, a different valid answer):** CSRF Protection and Session/Cookie Security — both are N/A because auth is header-based JWT, not cookies. Say this explicitly if asked "where's your CSRF protection" — don't let it sound like an oversight.

**Explicitly not implemented (say so plainly if asked, per the guide's own instruction):** File Upload Security (no real upload handler exists yet — document references are stored, not files), HTTPS/encryption-in-transit (deployment-layer, not app-layer, and this demo runs on plain HTTP locally), and a least-privilege dedicated DB user (currently uses `root` for local-dev simplicity).
