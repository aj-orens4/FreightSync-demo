# FreightSync — Role Dashboards & Administrator Provisioning

## Role-specific dashboards
FreightSync keeps one brand/design system but changes dashboard emphasis by role:
- **ADMIN** — Administrator Control Center: system KPIs, network, governance, user provisioning and Security Audit.
- **LOGISTICS_MANAGER** — Logistics Performance Center: route/tariff/SOP/schedule management without account/security administration.
- **ROUTE_PLANNER** — Network Planning Studio: map-first route planning with planning SOPs and schedules.
- **OPERATIONS_COORDINATOR** — Today's Operations Desk: timetable, schedule outcomes, delays, delay notes and reminders.
- **SERVICE_PROVIDER_ADMIN** — My Provider Operations: provider-scoped schedules and reminders only.

Backend RBAC remains the security boundary. Dashboard differences are UX, not a substitute for authorization.

## Administrator-provisioned accounts
Public registration is not part of the intended operational flow. ADMIN provisions users in **User Management** and assigns their role and provider scope when required. FreightSync generates a strong temporary password. New provisioned accounts have `must_change_password=1`, and after login they are redirected to Settings until they replace that temporary password.

ADMIN can deactivate/reactivate an account and issue a new temporary password. Password resets are audit logged and never store the readable temporary password.

## Existing database migration
For an existing FreightSync database, run `database/migration_account_provisioning.sql` once. Do not rerun the complete schema on an existing database.
