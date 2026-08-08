# Stage 5 Test Matrix

## Database and health

- Apply only the Stage 5 migration.
- `/api/health/commerce` returns `stage: 5` and `database: ready`.
- `campaignAssetStorage` remains `ready`.

## Asset deadlines

- Open `/admin/deadlines` as sales reviewer, finance, or system admin.
- Set a future due date and client note.
- Confirm the deadline appears in the agency asset repository.
- Confirm customer email and optional SMS records are queued.
- Clear the deadline and confirm the order updates.

## Reminder automation

- Run reminders from `/admin/notifications`.
- Confirm idempotent reminder records are created once per milestone.
- Test asset reminders for 7, 3, 1, 0, and overdue milestone days.
- Test invoice reminders and automatic overdue status.
- Test campaign-start and unreleased internal alerts.

## Email

- With Resend unconfigured, worker defers email without losing the record.
- Configure Resend and send a test notification.
- Confirm provider message ID and accepted status.
- Confirm webhook delivery updates `delivered_at`.
- Simulate a permanent bounce and confirm suppression/dead-letter handling.

## SMS

- With Twilio unconfigured, worker defers SMS without losing the record.
- Configure Twilio and send a consented transactional SMS.
- Confirm status callbacks update provider status.
- Confirm failed/undelivered events appear in provider history.

## Reliability

- Force a transient provider failure and confirm retry scheduling.
- Exceed maximum attempts and confirm `dead_letter`.
- Retry a dead-letter notification from administration.
- Cancel a queued notification.
- Run two workers simultaneously and confirm the automation lock prevents
  duplicate processing.

## Production build

```bash
npm run build
```
