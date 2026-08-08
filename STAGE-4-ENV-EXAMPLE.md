# Optional live notification environment variables

Asset uploads and review work without these values. When they are blank,
notifications remain queued in `notification_outbox`.

```env
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

NOTIFICATION_CRON_SECRET=CREATE_A_LONG_RANDOM_SECRET
```

Keep the existing values:

```env
INTERNAL_PROCESSING_EMAIL=processing@lagrandiosapr.com
SALES_REPLY_TO_EMAIL=ventas@lagrandiosapr.com
TRANSACTIONAL_FROM_EMAIL=orders@lagrandiosapr.com
```
