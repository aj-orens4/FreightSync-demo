# Module 9 – Service Provider & Network Control
### Freight Management System (FMS) — Group 9

---

## 1. Project Overview

The Freight Management System (FMS) is a university capstone project developed collaboratively across multiple groups, each responsible for one independent-but-integrable module. **Module 9 – Service Provider & Network Control** is the operational backbone that governs *how freight moves*: which routes exist, what they cost, what procedures govern their execution, and when vehicles depart and arrive.

Module 9 is built as a **standalone subsystem** with its own database, backend API, and frontend, but every entity is designed with **standardized IDs and REST endpoints** so that other groups' modules (Shipment, Fleet, Warehouse, Customer, Tracking, Billing, Reporting) can consume its data without rework.

**Stack selected for this build:**
- Backend: **Node.js + Express**
- Frontend: **Plain HTML / CSS / JavaScript** (fetch-based SPA-like pages)
- Database: **MySQL**
- Auth: JWT-based, with role-based access control (RBAC)

---

## 2. Scope of Module 9

### In Scope
1. **Service Network & Route Planner** — CRUD for routes, stops, distance/time capture, route status, basic optimization suggestions.
2. **Rate & Tariff Management** — CRUD for tariffs, approval workflow, automatic freight cost computation, tariff history/archive.
3. **SOP Manager** — CRUD for SOPs, version control, approval workflow, publishing, categorization, search, archive.
4. **Schedules & Transit Timetable Management** — CRUD for schedules, route assignment, conflict detection, delay logging, calendar view.
5. Role-based access control, audit logging, and a REST API designed for downstream integration.

### Out of Scope (belongs to other groups' modules)
- Actual shipment booking and tracking (Shipment/Tracking Management)
- Vehicle maintenance and driver management (Fleet Management)
- Warehouse inventory (Warehouse Management)
- Customer accounts and invoicing (Customer Management, Billing & Payment)
- Cross-module analytics dashboards (Reporting & Analytics) — Module 9 only *exposes* the data these would consume.

---

## 3. Target Users

| Role | Description |
|---|---|
| System Administrator | Full system access, user & role management |
| Logistics Manager | Manages routes, tariffs, SOP approvals, schedules |
| Route Planner | Plans routes, builds schedules |
| Operations Coordinator | Monitors timetables, reports delays, read access to routes |
| Service Provider Administrator | Manages own service/vehicle data, views assigned routes |

---

## 4. Functional Requirements

### FR-1 Service Network & Route Planner
- FR-1.1 Create, edit, delete a route (Route ID, name, origin, destination, stops, distance, ETT, status, provider, date created)
- FR-1.2 Manage intermediate stops (add/remove/reorder, each stop has sequence + distance-from-origin)
- FR-1.3 Change route status (Active / Inactive / Under Review / Discontinued)
- FR-1.4 Auto-calculate total distance from stop segments
- FR-1.5 Suggest optimization: flag routes where a stop detour exceeds a configurable threshold vs. direct distance
- FR-1.6 View route performance (linked schedule punctuality, when schedules exist)
- FR-1.7 List/filter/search routes by origin, destination, status, provider
- FR-1.8 Visual route network map (stops plotted with coordinates, routes drawn as connecting lines); for schedules currently in transit, show an estimated position along the route computed from elapsed scheduled time — this is a schedule-based simulation, not live GPS tracking (live vehicle tracking belongs to the separate Tracking System module per the class's module breakdown — see `08-future-integration-plan.md`)

### FR-2 Rate & Tariff Management
- FR-2.1 Create/update/archive tariffs (service type, vehicle type, weight range, distance range, base rate, additional charges, fuel surcharge, effective/expiration dates, status)
- FR-2.2 Tariff approval workflow: Draft → Pending Approval → Approved / Rejected → Archived
- FR-2.3 Auto-compute: `Total Freight Cost = Base Rate + Fuel Surcharge + Additional Charges`
- FR-2.4 Keep historical versions of a tariff whenever it changes (Tariff History table)
- FR-2.5 Support dynamic lookup: given weight + distance + service/vehicle type, return the matching active tariff and computed cost
- FR-2.6 Filter tariffs by status, service type, effective date range

### FR-3 SOP Manager
- FR-3.1 Create/edit an SOP with category, description, attached documents
- FR-3.2 Version control: every edit after publish creates a new version row, preserving prior versions
- FR-3.3 Approval workflow: Draft → Submitted → Approved / Rejected → Published
- FR-3.4 Publish / unpublish / archive an SOP
- FR-3.5 Categorize SOPs (e.g., Safety, Route Handling, Documentation, Emergency)
- FR-3.6 Full-text search by title, category, description
- FR-3.7 View SOP version history

### FR-4 Schedules & Transit Timetable Management
- FR-4.1 Create/update a schedule (route, departure/arrival location & time, vehicle, provider, status)
- FR-4.2 Detect scheduling conflicts (same vehicle double-booked, overlapping times on same route)
- FR-4.3 Log and manage delays (reason, new ETA, notify status)
- FR-4.4 Calendar view of schedules by day/week
- FR-4.5 Assign/reassign a route to a schedule
- FR-4.6 Filter/search schedules by route, provider, status, date range

### FR-5 Access, Audit & Integration
- FR-5.1 Authenticate users (JWT) and enforce role-based permissions per endpoint
- FR-5.2 Record an audit log entry for every create/update/delete/approval action (who, what, when, before/after)
- FR-5.3 Expose all core resources via versioned REST endpoints (`/api/v1/...`) for future module integration
- FR-5.4 Provide standardized numeric/UUID-style IDs safe for cross-module foreign keys

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Usability | Responsive UI (desktop-first, usable down to tablet width); consistent navigation shell |
| Security | Password hashing (bcrypt), JWT auth, RBAC middleware on every protected route, input validation & sanitization |
| Auditability | Immutable audit_logs table capturing all state-changing actions |
| Performance | Paginated list endpoints; indexed foreign keys and search columns |
| Scalability | Stateless API (horizontally scalable), connection pooling to MySQL |
| Maintainability | Layered architecture (routes → controllers → models → db), consistent error format |
| Reliability | Centralized error handling, transactional writes for multi-table operations (e.g., tariff history, SOP versioning) |
| Documentation | OpenAPI-style endpoint reference (see `05-api-design.md`) |
| Portability | `.env`-driven configuration; no hard-coded secrets or connection strings |
