# Resend Setup — Stage 5

Platform: Resend web dashboard.

1. Create or open the La Grandiosa Resend account.
2. Add and verify `lagrandiosapr.com` as a sending domain.
3. Add the DNS records Resend provides in Squarespace Domains.
4. Wait until the domain status is Verified.
5. Create a production API key and store it only in `.env.local` and Vercel.
6. Create a webhook pointing to:

```text
https://www.lagrandiosapr.com/api/webhooks/resend
```

7. Subscribe at minimum to delivered, bounced, complained, failed, and
   suppressed email events.
8. Copy the webhook signing secret to `RESEND_WEBHOOK_SECRET`.

Environment values:

```env
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
```

Do not share these secrets or commit them to Git.
