# Stage 6 Test Matrix

## Security headers

1. Open the public homepage and verify:
   - Content-Security-Policy
   - X-Content-Type-Options
   - X-Frame-Options
   - Referrer-Policy
   - Permissions-Policy
2. Open `/portal` and confirm:
   - Cache-Control is private/no-store
   - X-Robots-Tag blocks indexing
3. On production HTTPS, confirm HSTS is present.

## Authentication rate limiting

1. Attempt incorrect login fewer than eight times.
2. Confirm the normal generic credential error.
3. Exceed the identifier limit.
4. Confirm HTTP/application feedback indicates a temporary throttle.
5. Confirm a `security.rate_limit_blocked` event appears.
6. Wait for the window or purge only in development.

## Order and upload rate limiting

1. Submit normal test orders.
2. Confirm valid orders still succeed.
3. Exercise the documented rate limit in a non-production test agency.
4. Confirm HTTP 429 and Retry-After.
5. Confirm normal access resumes after the reset.

## Database audit

1. Open `/admin/security`.
2. Confirm no critical table is missing RLS.
3. Confirm no private bucket is public.
4. Confirm no active staff or purchasing user is missing verified MFA.
5. Confirm one active remittance account.
6. Save an audit snapshot.
7. Confirm the snapshot appears in Supabase.

## Launch checklist

1. Open `/admin/launch`.
2. Update a checklist item.
3. Confirm the database row changes.
4. Attempt signoff while a required item is pending.
5. Confirm signoff is blocked.
6. Complete or formally waive every required item.
7. Create a release signoff.
8. Confirm the signoff history records it.

## Environment and repository checks

```bash
node scripts/check-for-secrets.mjs
node scripts/verify-production-env.mjs
```

Both must exit successfully before production merge.

## Production smoke test

```bash
node scripts/smoke-test.mjs https://www.lagrandiosapr.com
```

Verify:

- Public homepage is reachable
- Login is reachable
- Unauthenticated portal redirects to login
- Commerce health reports Stage 6
- Production readiness reports `launchReady: true`

## Manual LED release

1. Confirm `LED_PROVIDER_MODE=manual`.
2. Approve assets and place the campaign in the release queue.
3. Follow the manual operator procedure.
4. Record the external/provider reference.
5. Mark Released.
6. Independently verify the screen.
7. Mark Live only after verification.
