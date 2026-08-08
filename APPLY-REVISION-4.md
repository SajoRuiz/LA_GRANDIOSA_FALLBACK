# Apply Stage 2B Revision 4

Replace these files:

```text
lib/pricing.ts
app/order/BookingConfigurator.tsx
app/order/DateRangeCalendar.tsx
app/order/order.module.css
app/cart/CartClient.tsx
```

Then run:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/order
```

## Important interpretation used by this revision

Any arbitrary range is accepted.

Exact month multipliers are:

```text
30–31, 60–61, 90–91, etc.
```

Other ranges are split into monthly units plus a partial remainder.

The 10% multi-month discount applies only when there is no partial remainder.
The 10% exact-date premium applies only to the partial remainder.
