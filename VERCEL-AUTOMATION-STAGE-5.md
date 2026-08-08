# Vercel Automation — Stage 5

## Environment variables

Add every `.env.local` value to Vercel Project Settings → Environment
Variables. Use:

```env
APP_BASE_URL=https://www.lagrandiosapr.com
TWILIO_STATUS_CALLBACK_URL=https://www.lagrandiosapr.com/api/webhooks/twilio/status
CRON_SECRET=<long-random-secret>
```

Never expose Supabase, Resend, Twilio, or Cron secrets with `NEXT_PUBLIC_`.

## Pro schedule

Merge the `crons` array from `deployment/vercel-pro.example.json` into the
project's existing `vercel.json`.

- Notification outbox: every 10 minutes
- Reminder scan: every day at 12:00 UTC (8:00 AM Puerto Rico)

## Hobby schedule

Hobby plans support only a daily cron cadence. Use
`deployment/vercel-hobby.example.json`, which calls the combined daily route.
For prompt transactional delivery, use the manual administration button until
upgrading the schedule or connecting a different scheduler.

Vercel automatically sends `CRON_SECRET` as a bearer token to cron routes.
