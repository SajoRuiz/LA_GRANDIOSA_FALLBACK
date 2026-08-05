# La Grandiosa Commerce — Stage 3A

This package extends Stage 2B Revision 4 with the secure customer-information
and order-record foundation.

## New routes

```text
/checkout/client
/checkout/received
/api/orders/draft
/api/health/commerce
```

## New server folders

```text
lib/server/
lib/supabase/
supabase/migrations/
```

## Approved email configuration

```env
INTERNAL_PROCESSING_EMAIL=processing@lagrandiosapr.com
SALES_REPLY_TO_EMAIL=ventas@lagrandiosapr.com
TRANSACTIONAL_FROM_EMAIL=orders@lagrandiosapr.com
```

## Important

The notification records are queued but not sent in Stage 3A. Contract
acceptance, Stripe card/ACH payment, Client Code validation, email delivery,
and SMS delivery are Stage 3B.
