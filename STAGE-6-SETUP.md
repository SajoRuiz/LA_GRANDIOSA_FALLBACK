# Stage 6 Setup — Production Launch and Security Certification

## 1. Preserve Stage 5

```bash
git add .
git commit -m "Complete Stage 5 communications and automation"
git push
git switch -c stage-6-production-security
```

## 2. Install the Stage 6 patch

Copy the patch contents into the root of the existing project and replace the
matching files.

## 3. Confirm Next.js 14 middleware naming

The project must contain:

```text
middleware.ts
```

It must not contain:

```text
proxy.ts
```

## 4. Add local Stage 6 variables

Generate a development salt:

```bash
openssl rand -base64 48
```

Add it to `.env.local`:

```env
SECURITY_HASH_SALT=generated-value
LED_PROVIDER_MODE=manual
LED_PROVIDER_API_BASE_URL=
LED_PROVIDER_API_KEY=
```

Never commit `.env.local`.

## 5. Apply the migration

Run only:

```text
supabase/migrations/202608110001_stage_6_production_security.sql
```

through the Supabase SQL Editor.

## 6. Verify files

```bash
bash VERIFY-STAGE-6.sh
```

## 7. Restart

```bash
rm -rf .next
npm run dev
```

## 8. Health checks

```text
http://localhost:3000/api/health/commerce
http://localhost:3000/api/health/production
```

The production endpoint may return HTTP 503 during certification. That is
expected until blockers and required checklist items are cleared.

## 9. Administration

```text
/admin/security
/admin/launch
```

## 10. Local validation

```bash
node scripts/check-for-secrets.mjs
APP_BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs --allow-not-ready
npm run build
```

`verify-production-env.mjs` is intended for a Production-like environment with
HTTPS and real provider variables.
