# FreightSync Security Defense Map

This maps the supplied System Security & Defense Guide to the actual project.

- Authentication: `backend/controllers/auth.controller.js` login verifies username/password and issues an expiring HS256 JWT; `backend/middleware/auth.js` verifies Bearer tokens.
- Password security: bcrypt hash/compare in `auth.controller.js` and admin user creation; plaintext passwords are not stored.
- Authorization/RBAC: `authenticate` + `authorize(...)` in `backend/middleware/auth.js`; applied in routes for routes, tariffs, SOPs, schedules, users and audit logs. User/audit management is ADMIN-only.
- Provider scope: service-provider administrators are restricted by provider_id in schedule controllers.
- Input validation: `backend/utils/validate.js` plus controller validation.
- SQL injection defense: mysql2 parameter placeholders are used for user-controlled values.
- XSS defense: frontend user-originated strings are escaped with `escapeHtml()` before HTML interpolation.
- API security: protected routers require JWT authentication; mutation routes add role authorization.
- Rate limiting: `backend/middleware/rateLimit.js`, including stricter auth limiting.
- Security headers: Helmet in `backend/server.js`.
- Secrets management: `.env`/`.env.example`; `.env` is ignored by Git. JWT secret is required to be at least 32 characters.
- Error handling: centralized `backend/middleware/errorHandler.js`.
- Audit trail: `audit_logs` + `backend/utils/audit.js`; admin-only viewer. Logs can be archived/restored, not permanently deleted, to preserve evidence.
- Backup/recovery: `database/backup.sh` is provided; production scheduling/restore testing remains deployment work.
- Dependency security: npm package lock is present. Run `npm audit`; do not blindly use `--force` without regression testing.

## Controls that are deployment-dependent or not applicable yet
- HTTPS/TLS must be provided by the production host/reverse proxy. Localhost development is HTTP.
- Cookie/CSRF controls are not used for authentication because this build sends JWTs in the Authorization header rather than auth cookies. If auth is migrated to HttpOnly cookies, CSRF protection must be added.
- File-upload security is not applicable until a file-upload feature is introduced.
- Database least-privilege must be configured in MySQL/hosting; do not use the MySQL root account in production.
- Automated security tests should be expanded before production deployment.
