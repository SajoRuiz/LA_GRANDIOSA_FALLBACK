# Backup and Recovery Runbook

## Scope

Back up and recover:

- Supabase Postgres data
- Supabase Storage objects
- GitHub source code and migration history
- Vercel configuration
- Resend/Twilio configuration documentation
- Bank-remittance operational records
- LED release evidence

## Database

1. Confirm the active Supabase backup or PITR plan.
2. Record retention and recovery-window commitments.
3. Keep every migration under `supabase/migrations`.
4. Test recovery into a separate non-production project.
5. Validate:
   - Users and roles
   - Orders and pricing snapshots
   - Credit holds and ledger
   - PO and invoice records
   - Asset metadata
   - Notification history
   - Launch/security audit records

## Storage

Database backup alone may not restore Storage object bytes. Maintain an
approved Storage backup/export process for:

```text
purchase-orders
campaign-assets
```

Test that restored metadata and object paths remain consistent.

## Recovery decision

- Configuration/code issue: roll back Vercel deployment.
- Data issue: stop writes, preserve evidence, restore to a separate project,
  validate, then approve cutover.
- Storage issue: restore objects and validate checksums/versions.
- Credential issue: rotate credentials before returning service.

## Required evidence

Document recovery date, operator, source backup, target, validation results,
data-loss window, and final approval.
