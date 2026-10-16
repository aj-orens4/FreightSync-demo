# API Design — Module 9 REST Endpoints

Base URL: `/api/v1`
Auth: `Authorization: Bearer <JWT>` on every endpoint except `/auth/login`
Standard error shape: `{ "success": false, "message": "...", "errors": [...] }`
Standard success shape: `{ "success": true, "data": ..., "meta": { "page":1, "limit":20, "total":N } }` (list endpoints include `meta`)

## Auth
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | /auth/login | Public | Returns JWT + user profile |
| POST | /auth/logout | Any | Client-side token discard (stateless) |
| GET  | /auth/me | Any | Current user profile |

## Routes
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | /routes | All | List/filter/search routes (`?status=&origin=&destination=&provider_id=&page=&limit=`) |
| GET | /routes/:id | All | Get route + stops |
| POST | /routes | Admin, Logistics Manager, Route Planner | Create route + stops |
| PUT | /routes/:id | Admin, Logistics Manager, Route Planner | Update route + stops |
| PATCH | /routes/:id/status | Admin, Logistics Manager | Change route status |
| DELETE | /routes/:id | Admin, Logistics Manager | Delete route (blocked if referenced by active schedules) |
| GET | /routes/:id/performance | All | On-time vs delayed ratio from linked schedules |
| GET | /routes/:id/optimization | Route Planner, Logistics Manager | Flag stop detours over threshold |

## Tariffs
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | /tariffs | All | List/filter tariffs (`?status=&service_type=&vehicle_type=`) |
| GET | /tariffs/:id | All | Get tariff detail |
| POST | /tariffs | Admin, Logistics Manager | Create tariff (status=Draft) |
| PUT | /tariffs/:id | Admin, Logistics Manager | Update tariff (snapshots previous into history) |
| PATCH | /tariffs/:id/submit | Admin, Logistics Manager | Draft → Pending Approval |
| PATCH | /tariffs/:id/approve | Logistics Manager, Admin | Pending → Approved |
| PATCH | /tariffs/:id/reject | Logistics Manager, Admin | Pending → Rejected |
| PATCH | /tariffs/:id/archive | Logistics Manager, Admin | → Archived |
| GET | /tariffs/:id/history | All | List historical snapshots |
| POST | /tariffs/quote | All | Compute cost given `{service_type, vehicle_type, weight_kg, distance_km}` |

## SOPs
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | /sops | All | List/search (`?category=&status=&q=`) |
| GET | /sops/:id | All | Get SOP + documents |
| POST | /sops | Admin, Logistics Manager, Route Planner | Create SOP (Draft) |
| PUT | /sops/:id | Admin, Logistics Manager, Route Planner | Edit SOP (auto-versions if already Published) |
| PATCH | /sops/:id/submit | Author roles | Draft → Submitted |
| PATCH | /sops/:id/approve | Logistics Manager, Admin | Submitted → Approved |
| PATCH | /sops/:id/publish | Logistics Manager, Admin | Approved → Published |
| PATCH | /sops/:id/archive | Logistics Manager, Admin | → Archived |
| GET | /sops/:id/versions | All | Version history |
| POST | /sops/:id/documents | Author roles | Attach a document reference |

## Schedules
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | /schedules | All | List/filter (`?route_id=&status=&date_from=&date_to=&provider_id=`) |
| GET | /schedules/:id | All | Get schedule + delay history |
| POST | /schedules | Admin, Logistics Manager, Route Planner | Create (409 on conflict) |
| PUT | /schedules/:id | Admin, Logistics Manager, Route Planner | Update (re-checks conflicts) |
| PATCH | /schedules/:id/status | Admin, Logistics Manager, Ops Coordinator | Change status |
| POST | /schedules/:id/delay | Ops Coordinator, Service Provider Admin | Log a delay |
| GET | /schedules/calendar | All | `?from=&to=` grouped-by-day view |

## Users (Admin only)
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | /users | Admin | List users |
| POST | /users | Admin | Create user |
| PUT | /users/:id | Admin | Update user / role / active flag |

## Audit Logs
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | /audit-logs | Admin | Filter by entity_type, user_id, date range |

## Integration-Ready Design Notes
- All list endpoints are paginated (`page`, `limit`) and return `total` for downstream aggregation.
- Every entity has a stable `*_code` safe to reference from other modules (see `04-database-design.md §3`).
- Endpoints are versioned under `/api/v1` so breaking changes for other modules' integration can go to `/api/v2` without disruption.
- Recommended event-driven extension: emit domain events (`route.created`, `tariff.approved`, `schedule.delayed`, `sop.published`) to a message broker (e.g., RabbitMQ/Kafka) so Shipment, Tracking, and Billing modules can react without polling. Not implemented in this build (out of scope for a single-module capstone deliverable) but the controller layer already isolates state changes at single points, making it straightforward to add an `emitEvent(...)` call per action later.
