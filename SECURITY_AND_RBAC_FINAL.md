# FreightSync — Security & Role Access Finalization

## Authentication and account policy
- Passwords are stored with bcrypt, never plaintext.
- JWTs are signed with HS256 and require a configured secret of at least 32 characters.
- Login is rate-limited and failed/successful login events are audit logged.
- Public self-registration is disabled. Administrators provision accounts so users cannot self-assign privileged roles or provider scope.
- Password changes verify the current password and require 10–72 characters with uppercase, lowercase, number and symbol.
- Helmet security headers, JSON body-size limits, API-wide rate limiting, restricted CORS, input escaping, and centralized errors remain enabled.

## Role workspaces
- ADMIN: all Module 9 features, User Management, Security Audit.
- LOGISTICS_MANAGER: routes, tariffs, SOPs, schedules, calendar; management permissions according to backend RBAC.
- ROUTE_PLANNER: routes, SOPs, schedules, calendar; no tariff/admin navigation.
- OPERATIONS_COORDINATOR: schedule operations and calendar/reminders; no configuration/admin navigation.
- SERVICE_PROVIDER_ADMIN: provider-scoped schedules and calendar/reminders; delay reporting is limited to the assigned provider.

Backend route authorization remains the authority for write operations; hiding a frontend control is never treated as the security boundary.

## UX completion
- Reference-led logistics dashboard redesign with dark operational navigation + clean structured workspace.
- Role-specific navigation and dashboard content.
- Delayed schedule notes are visible directly in the schedule table, with full delay history available in a detail dialog.
- Dialogs use fixed actions and a scrollable content region rather than scrolling the whole popup; Escape/backdrop dismissal is supported.
