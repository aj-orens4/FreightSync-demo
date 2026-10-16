# Future Integration Plan

Module 9 was built as a standalone subsystem, but every design decision below was made specifically so other groups' modules can integrate with minimal friction once the full Freight Management System is assembled.

## 1. Integration Contracts Already in Place
- **Standardized codes**: `route_code`, `tariff_code`, `sop_code`, `schedule_code` are stable, human-readable identifiers other modules should store as foreign references instead of Module 9's internal auto-increment IDs (see `04-database-design.md §3`).
- **Versioned REST API**: all endpoints live under `/api/v1`, so a `/api/v2` can be introduced later without breaking modules already integrated against v1.
- **Consistent response envelope**: `{ success, data, meta }` / `{ success: false, message, errors }` across every endpoint, so a shared API client in another module's frontend can be written once.
- **JWT-based auth**: any module sharing the same `JWT_SECRET` and `users`/`roles` tables can validate Module 9 tokens without a separate login.

## 2. Planned Integration Points by Module

| Module | Integration Direction | Mechanism |
|---|---|---|
| Shipment Management | Shipment records reference a `route_code` and a resolved `tariff_code` (via `/tariffs/quote`) to price a shipment | REST call at shipment-creation time |
| Fleet Management | Provides `vehicle_code` values that Module 9's `schedules.vehicle_code` currently stores as a free-text field; once Fleet Management exists, this becomes a validated FK/lookup call | REST call to validate vehicle availability before schedule creation |
| Warehouse Management | May reference `route_stops` to know which warehouse sits at which stop | REST read of `/routes/:id` (includes stops) |
| Customer Management | Not directly coupled to Module 9; consumes tariff quotes indirectly through Shipment Management | N/A (indirect) |
| Tracking System | Subscribes to schedule status changes (`Scheduled → In Transit → Delayed/Completed`) to update live tracking views | Recommended: event emission (see below) rather than polling |

> **Note on Module 9's own route map:** the dashboard and Routes page include a visual map showing routes and, for in-transit schedules, an *estimated* position marker computed from elapsed scheduled time. This is a schedule-based simulation for route visualization (FR-1.8), not real GPS tracking, and does not duplicate the Tracking System module's job of ingesting live vehicle location feeds.
| Billing & Payment | Consumes `/tariffs/quote` results to generate invoices | REST call |
| Reporting & Analytics | Reads audit logs, route performance (`/routes/:id/performance`), and schedule/tariff history for cross-module dashboards | REST reads; potential future read-replica or data warehouse export |

## 3. Recommended Event-Driven Extension
The controller layer already isolates every state change to a single point per action (e.g., tariff approval happens in exactly one function). This makes it straightforward to add a message-broker emission (RabbitMQ/Kafka/similar) alongside the existing `logAction(...)` audit call, without restructuring the codebase:

```
route.created / route.status_changed
tariff.approved / tariff.archived
sop.published
schedule.created / schedule.status_changed / schedule.delayed
```

Other modules (especially Tracking and Reporting) would subscribe to these events instead of polling REST endpoints, reducing cross-module coupling and load once the full FMS is integrated.

## 4. Schema Compatibility Notes for the Integration Phase
- All monetary columns use `DECIMAL`, not `FLOAT`, to avoid rounding-error mismatches when Billing & Payment consumes these values.
- `service_providers` is intentionally kept minimal in Module 9 (code, name, contact, status) — if Fleet Management introduces a richer provider/vehicle model, Module 9's `provider_id` FK can point at that shared table instead of its own once the databases are consolidated, since the column only stores an integer reference.
- Timestamps are stored as `DATETIME` (not `TIMESTAMP`) to avoid timezone-conversion surprises when consolidating databases across modules built by different groups.
