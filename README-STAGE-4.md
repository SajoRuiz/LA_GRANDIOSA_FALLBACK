# La Grandiosa Commerce — Stage 4

## Scope

- Private campaign-asset repository
- Required slots for Left, Center, and Right screens
- Resumable TUS uploads with progress and recovery
- Image and video preview window
- Version history without overwriting prior files
- Upload-receipt notification
- Final `Submit Assets for Review` confirmation
- Private processing-team review queue
- Screen-specific revision requests
- Final asset approval
- Manual release queue ready for a future LED provider API
- Optional live email through Resend
- Optional live SMS through Twilio
- Notification delivery-status tracking

## Important technical-specification boundary

Final LED pixel dimensions were not supplied. Stage 4 therefore stores editable
asset specifications, validates file type and file size, reports browser media
metadata, and requires human approval. Pixel dimensions remain null until the
LED provider supplies authoritative specifications.

## Provisional upload rules

- Still images: JPEG or PNG, maximum 50 MB
- Silent video: MP4 or MOV, maximum 500 MB
- Video expected duration: purchased 10, 15, 30, or 60 seconds
- Audio is not part of this rate card

These values can be revised in `asset_specifications` without changing the
historic specification snapshots already attached to an order.

## Install dependencies

```bash
npm install tus-js-client resend twilio
```

## Apply migration

Run only:

```text
supabase/migrations/202608090001_stage_4_assets_notifications.sql
```

## New routes

Agency:

```text
/portal/orders/[orderId]/assets
```

Internal:

```text
/admin/assets
/admin/assets/[submissionId]
/admin/releases
/admin/notifications
```

## Notification behavior

All workflow actions create outbox records. If Resend/Twilio are not configured,
the workflow remains functional and messages stay queued. The internal
notifications page can process queued messages after provider credentials are
added.
