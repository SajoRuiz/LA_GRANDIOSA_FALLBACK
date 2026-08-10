# Production Launch Checklist

The authoritative interactive checklist is:

```text
/admin/launch
```

Use this document as the operational companion.

## Before production deployment

- All required Supabase migrations applied once
- Vercel Production environment variables configured
- Preview credentials isolated from Production
- Public signup disabled
- Every active staff user enrolled in MFA
- Every active agency purchaser enrolled in MFA
- Role matrix tested
- RLS and PostgreSQL grants audited
- Storage buckets confirmed private
- Bank remittance verified by finance
- Tax treatment approved
- Contract and privacy terms approved
- Resend domain verified
- Email delivery and webhook tested
- SMS configured or formally waived
- Cron routes protected and scheduled
- Database backup plan confirmed
- Restore procedure tested outside Production
- Repository secret scan passed
- Production build passed
- End-to-end test passed
- Mobile/browser test passed
- Manual LED release procedure approved

## Deployment sequence

1. Merge the reviewed Stage 6 branch into `main`.
2. Wait for the Vercel Production deployment to become Ready.
3. Run the production smoke test.
4. Review `/admin/security`.
5. Save a final audit snapshot.
6. Complete `/admin/launch`.
7. Create the production release signoff.
8. Monitor notifications, login failures, uploads, and release queue.
