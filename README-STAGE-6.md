# La Grandiosa Commerce — Stage 6

## Production Launch and Security Certification

Stage 6 adds:

- Production security headers
- Login, order, PO-upload, and asset-upload rate limiting
- Security-event logging
- Database, MFA, RLS, grants, and Storage readiness audits
- Production launch checklist and signoff
- Environment-variable verification
- Repository secret scanning
- Production smoke testing
- Security maintenance automation
- Operations, backup, incident-response, and launch runbooks
- A provider-neutral LED-screen API adapter contract

## New internal routes

```text
/admin/security
/admin/launch
```

## New health route

```text
/api/health/production
```

This route returns HTTP 503 until automatic blockers are cleared and every
required launch-checklist item is passed or formally waived.

## New environment variables

```env
SECURITY_HASH_SALT=
LED_PROVIDER_MODE=manual
LED_PROVIDER_API_BASE_URL=
LED_PROVIDER_API_KEY=
```

Use at least 32 random characters for `SECURITY_HASH_SALT`.

Keep `LED_PROVIDER_MODE=manual` until the operator supplies final API
documentation, sandbox access, authentication requirements, technical
specifications, and status mappings.

## Production scripts

```bash
node scripts/check-for-secrets.mjs
node scripts/verify-production-env.mjs
node scripts/smoke-test.mjs https://www.lagrandiosapr.com
```

For pre-launch testing while checklist items remain open:

```bash
node scripts/smoke-test.mjs --allow-not-ready https://www.lagrandiosapr.com
```

## Important

Stage 6 does not automatically publish the website. The system administrator
must complete `/admin/launch` and create a production release signoff.
