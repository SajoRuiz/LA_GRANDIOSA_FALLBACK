# Security Operations Manual

## Daily

- Review failed and dead-letter notifications.
- Review failed release-queue items.
- Review purchase-order and invoice exceptions.
- Review security events with warning or critical severity.
- Verify automation completed.
- Investigate unusual rate-limit blocks.

## Weekly

- Review active staff and agency memberships.
- Revoke users who no longer require access.
- Review expired or unused invitations.
- Confirm every active privileged user has MFA.
- Review overdue invoices and credit exceptions.
- Review Storage upload and download access patterns.
- Save a security audit snapshot after material changes.

## Monthly

- Review Vercel and Supabase access.
- Review Supabase secret/service-role key use.
- Rotate credentials when required by policy or incident.
- Test one non-production restore.
- Review notification provider suppression lists.
- Review LED release failures and manual verification evidence.
- Confirm bank remittance instructions remain correct.

## Privileged roles

```text
system_admin
finance
sales_reviewer
agency_admin
agency_buyer
```

Use the least-privileged role. Never share an account.

## Suspicious activity

1. Suspend the affected user or agency membership.
2. Revoke active sessions.
3. Rotate potentially exposed secrets.
4. Preserve security events and provider logs.
5. Review affected orders, invoices, assets, and release records.
6. Follow the incident-response runbook.
