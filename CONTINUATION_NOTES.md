# Claude → ChatGPT continuation completion

This build continues the final unfinished Claude turn from the user's exported conversation and preserves the existing FreightSync architecture.

Completed/verified in this continuation:
- Admin-only User Management UI wired to `/api/v1/users`.
- Admin-only Audit Log UI wired to `/api/v1/audit-logs`.
- Admin navigation appears only for ADMIN users.
- SERVICE_PROVIDER_ADMIN schedule list/calendar/detail/delay access is scoped to the provider in the JWT.
- Provider-admin self-registration removed; admins provision these accounts with a provider assignment.
- Delay history is visible from delayed schedules.
- Self-service password change added in Settings with bcrypt verification/hash and audit logging.
- Mini dashboard calendar date keys use local calendar dates instead of UTC `toISOString()` day keys, avoiding UTC+8 date shifting.
- Existing dashboard widget customization, role action controls, reminders, map, SOP/tariff/route modules, auth/RBAC and security work retained.
- All backend and frontend JavaScript files pass `node --check`.

Runtime verification still requires the user's MySQL environment and `.env` values; no database credentials were included or modified.
