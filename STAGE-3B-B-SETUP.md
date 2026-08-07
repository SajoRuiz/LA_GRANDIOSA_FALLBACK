# Stage 3B-B Setup

## 1. Create a branch

```bash
git switch -c stage-3b-b-pricing-credit
```

## 2. Install the patch

Copy the contents of the patch into the root of the existing LaGrandiosa
project. Replace files when prompted.

For Next.js 14, the project root must contain:

```text
middleware.ts
```

Remove an obsolete root `proxy.ts` if it still exists.

## 3. Apply the migration

In Supabase:

```text
SQL Editor → New query
```

Run:

```text
supabase/migrations/202608070002_stage_3b_b_agency_pricing_credit.sql
```

Do not rerun the older Stage 3A or Stage 3B-A migrations.

## 4. Restart

```bash
rm -rf .next
npm run dev
```

## 5. Health check

```text
http://localhost:3000/api/health/commerce
```

Expected:

```json
{
  "ok": true,
  "stage": "3B-B",
  "database": "ready",
  "agencyPricing": "active",
  "creditControls": "active"
}
```

## 6. Test agency portal

```text
/portal
```

The credit-position card should show approved, exposed, held, pending, and
available amounts.

## 7. Test the cart

```text
/order → /cart
```

The cart should display public published pricing, negotiated agency discount,
net contract total, and credit projection.

## 8. Test within-limit order

Create an order below available credit. It should return:

```text
creditStatus = within_limit
```

and create an active credit hold.

## 9. Test exception review

Create an order above available credit. It should return:

```text
creditStatus = review_required
```

Open:

```text
/admin/credit
```

Approve or decline the exception.
