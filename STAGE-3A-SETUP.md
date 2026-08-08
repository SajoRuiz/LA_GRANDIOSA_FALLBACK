# La Grandiosa Commerce — Stage 3A Setup

## What Stage 3A adds

- Mandatory client name, email, telephone, and address
- Optional company, agency, campaign, and PO references
- Server-side revalidation of every cart SKU and price
- Secure order and order-item records in Supabase Postgres
- Order numbers in the format `LG-YYYY-000001`
- Order status history
- Audit log
- Notification outbox
- Internal processing destination: `processing@lagrandiosapr.com`
- Customer reply-to: `ventas@lagrandiosapr.com`
- Transactional sender setting: `orders@lagrandiosapr.com`

Stage 3A does not yet send email or SMS, accept payment, generate the final
contract PDF, or open the asset repository. Those services are activated in
Stage 3B and Stage 4.

## 1. Install the dependency

```bash
npm install @supabase/supabase-js
```

## 2. Create a Supabase project

Create separate development and production projects when possible.

## 3. Create `.env.local`

Copy `.env.example` to `.env.local` and enter the Supabase URL and keys.
The approved email settings are already present.

## 4. Apply the database migration

Recommended: use the Supabase CLI migration workflow.

Migration file:

```text
supabase/migrations/202608040001_stage_3a_orders.sql
```

For an initial manual development setup, the same SQL can be run once in the
Supabase SQL Editor. Once the repository adopts migration history, keep all
future schema changes in migration files.

## 5. Test configuration

Start the site:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/api/health/commerce
```

Expected result:

```json
{
  "ok": true,
  "stage": "3A",
  "database": "ready"
}
```

## 6. Test the customer flow

1. Add at least one advertising combination.
2. Open `/cart`.
3. Select `Continue to client information`.
4. Complete all mandatory fields.
5. Submit.
6. Confirm that the browser displays an `LG-YYYY-######` order number.
7. In Supabase, verify rows in:
   - `client_contacts`
   - `orders`
   - `order_items`
   - `order_status_history`
   - `audit_log`
   - `notification_outbox`

## 7. Vercel environment variables

Add the same environment variables under:

```text
Vercel Project → Settings → Environment Variables
```

Use separate Supabase keys for Preview and Production if separate projects are
available.

## Security notes

- Never commit `.env.local`.
- Never expose the service-role key to the browser.
- Stage 3A tables have RLS enabled and no browser-access policies.
- The server route recalculates pricing and does not trust totals from local
  storage.
- The notification outbox queues records but does not yet send them.
