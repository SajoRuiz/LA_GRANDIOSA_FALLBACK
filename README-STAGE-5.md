# La Grandiosa Stage 5 — Communications and Production Automation

Stage 5 activates the communications infrastructure around the existing order,
invoice, asset, review, and release workflows.

## Features

- Resend transactional email delivery
- Twilio transactional SMS delivery
- Verified provider webhooks
- Provider event history
- Automatic retries with exponential backoff
- Dead-letter handling
- Recipient suppression after permanent email failures
- Invoice due and overdue reminders
- Asset deadline assignment and reminders
- Campaign-start and completion alerts
- Protected automation endpoints
- Manual notification and reminder controls

## Install

Copy the Stage 5 patch into the project root, then apply only:

```text
supabase/migrations/202608100001_stage_5_communications_automation.sql
```

No new npm dependency is required when Stage 4 already installed `resend` and
`twilio`. Verify them with:

```bash
npm ls resend twilio
```

Run:

```bash
bash VERIFY-STAGE-5.sh
rm -rf .next
npm run dev
```

## Provider-optional behavior

Without provider credentials, records remain safely queued. Staff can still
inspect the outbox, run reminder scans, retry failures, and cancel messages.

## Private administration

```text
/admin/notifications
/admin/deadlines
```

## Automation endpoints

```text
/api/internal/notifications/process
/api/internal/reminders/process
/api/internal/automation/daily
```

All automation endpoints require either an authenticated AAL2 staff session or
`Authorization: Bearer <CRON_SECRET>`.
