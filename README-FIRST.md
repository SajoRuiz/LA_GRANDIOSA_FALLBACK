# La Grandiosa Commerce — Stage 2A

## Locked business decisions implemented

1. Pricing:
   - 1–29 days: daily proration from `Tarifa Mensual` plus 10%
   - 30–31 days: full `Tarifa Mensual`, with no 10% premium
   - More than 31 days: temporarily blocked pending a multi-month rule
2. Selling rate:
   - `Tarifa Mensual`
3. Date range:
   - Start and end dates are both included
4. Contract:
   - Multiple combinations in one cart/contract

## Formula

For 1–29 inclusive days:

```text
Prorated base = round((monthly rate in cents × inclusive days) ÷ 31)
Premium = round(prorated base × 10%)
Line total = prorated base + premium
```

For 30 or 31 inclusive days:

```text
Media subtotal = Tarifa Mensual
Premium = $0
Line total = Tarifa Mensual
```

## What this package adds

- Shared pricing utility
- Browser-based multi-item contract cart
- Updated `/order` configurator
- `/cart` contract preview
- Per-line and contract totals
- Add/remove/clear cart actions
- Duplicate line prevention for the same SKU and exact date range

## Prototype limitation

The cart is stored in browser `localStorage`.

That is appropriate for testing the customer flow, but it is not the final
production order record. Stage 2B will move draft contracts and availability
holds into the database.

## Install

Copy/replace these folders in the existing project:

```text
app/order/
app/cart/
data/
lib/
```

You may delete the old:

```text
app/order/review/
```

because `/cart` now serves as the multi-item contract preview.

Ensure the homepage PLACE ORDER buttons point to:

```text
/order
```

Run:

```bash
npm run dev
```

Test:

```text
http://localhost:3000/order
http://localhost:3000/cart
```

## Suggested test

Add these two items to one contract:

1. 15s Silent Video · All 3 Screens · Prime
2. 30s Still Image · Center · Standard

Use inclusive dates and confirm:

- A 1–29 day line shows daily proration and the 10% premium
- A 30- or 31-day line shows a monthly buy and no premium
- The cart shows the combined contract total
- Remove and Clear Contract work correctly

## Not included yet

- Database
- Availability engine
- Temporary inventory holds
- Customer/agency information
- Legal terms acceptance
- PDF contract generation
- Credit-card payment
- Customer-code validation
- Asset upload
- Notifications
