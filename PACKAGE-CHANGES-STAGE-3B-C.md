# Stage 3B-C Package Changes

## New database migration

- `supabase/migrations/202608080001_stage_3b_c_po_invoicing_remittance.sql`

## New server helpers

- `lib/server/procurement.ts`
- `lib/server/invoice-pdf.ts`

## New agency portal routes

- `app/portal/orders/`
- `app/portal/invoices/`

## New internal routes

- `app/admin/purchase-orders/`
- `app/admin/invoices/`
- `app/admin/remittance/`

## New API routes

- `app/api/purchase-orders/`
- `app/api/admin/purchase-orders/`
- `app/api/admin/invoices/`
- `app/api/admin/remittance/`
- `app/api/invoices/`

## Updated files

- `app/checkout/client/ClientInformationForm.tsx`
- `app/checkout/received/page.tsx`
- `app/portal/page.tsx`
- `app/admin/agencies/page.tsx`
- `app/admin/credit/page.tsx`
- `app/api/health/commerce/route.ts`

## New dependency

```bash
npm install pdf-lib
```

## Current tax behavior

The invoice code preserves the existing Stage 3B-B value of `tax_cents = 0`.
No sales-tax rule is introduced by this package. Tax treatment should be
confirmed with the company's accountant before production launch.
