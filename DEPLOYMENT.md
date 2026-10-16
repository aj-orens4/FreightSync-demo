# FreightSync production deployment

FreightSync is production-ready as a single Node/Express web service: in `NODE_ENV=production`, Express serves both `/frontend` and `/api/v1`. The browser automatically uses the same HTTPS origin for the API, while local development still uses `localhost:4000`.

## Required production environment variables
Set these in the hosting provider's environment-variable UI. Never commit `.env`.

- `NODE_ENV=production`
- `PORT` (normally injected by the host)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET` (long random secret, 32+ characters)
- `JWT_EXPIRES_IN=8h`
- `CORS_ORIGIN=https://YOUR-PUBLIC-DOMAIN`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

## Database
Import `database/schema.sql` for a brand-new database. For an existing FreightSync database, run `database/migration_completeness.sql` once. Existing data is preserved by the migration.

## Railway
`railway.json` is included. Create a Node service from the repository and a MySQL service, then map the MySQL connection values to the variables above. Generate a public domain for the Node service. Set `CORS_ORIGIN` to that exact HTTPS domain and redeploy.

## Before going live
1. Replace all seeded/demo email addresses with real account emails so 2FA can be delivered.
2. Use a new production JWT secret and production SMTP App Password.
3. Test all five roles and verify unauthorized API requests return 403.
4. Create and download a Backup & Recovery snapshot.
5. Test the public URL on a phone and desktop.
