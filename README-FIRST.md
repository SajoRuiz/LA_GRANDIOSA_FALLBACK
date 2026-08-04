# Install Stage 2B — Revision 3

Revision 3 makes the holiday/monthly rule explicit:

```text
Monthly qualification is determined before holiday subtraction.
```

Therefore:

- a complete calendar month, including February, is a monthly buy;
- any rolling 30- or 31-day range is a monthly buy;
- closed holidays subtract from the monthly price;
- holiday subtraction does not activate the 10% exact-date premium;
- full multi-month buys receive holiday deductions first and the 10% discount
  second.

## Replace an existing Stage 2B installation

Replace:

```text
lib/pricing.ts
app/order/BookingConfigurator.tsx
app/cart/CartClient.tsx
```

The full package also includes the unchanged supporting commerce files.

## Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000/order
http://localhost:3000/cart
```

Review the examples in:

```text
PRICING-TEST-MATRIX.md
```

before enabling production payment.


## Revision 4

- Every valid date range is accepted.
- 30–31, 60–61, 90–91 days, and onward multipliers are full-month buys.
- Other ranges are split into monthly units plus partial days.
- The order page now contains an always-visible inline calendar.
