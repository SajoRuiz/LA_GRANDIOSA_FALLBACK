# Vercel Production Setup

## Production branch

```text
main
```

## Production URL

```text
https://www.lagrandiosapr.com
```

Set:

```env
APP_BASE_URL=https://www.lagrandiosapr.com
TWILIO_STATUS_CALLBACK_URL=https://www.lagrandiosapr.com/api/webhooks/twilio/status
```

## Required Production secrets

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY
- INTERNAL_PROCESSING_EMAIL
- SALES_REPLY_TO_EMAIL
- TRANSACTIONAL_FROM_EMAIL
- RESEND_API_KEY
- RESEND_WEBHOOK_SECRET
- CRON_SECRET
- SECURITY_HASH_SALT

## Optional / conditional

- Twilio credentials, unless SMS is waived
- LED provider credentials only when API mode is certified

## Cron

Merge one approved cron example into the existing `vercel.json`.

Pro example includes:

- Notification processing
- Reminder processing
- Security maintenance

Hobby example uses the combined daily automation route.

## Verification

After deployment:

```bash
APP_BASE_URL=https://www.lagrandiosapr.com node scripts/verify-production-env.mjs
node scripts/smoke-test.mjs https://www.lagrandiosapr.com
```

Environment verification normally runs inside Vercel or CI where Production
secrets are available.
