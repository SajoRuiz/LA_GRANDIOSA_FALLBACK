# Apply Revision 3 Pricing Patch

Replace these files in the existing project:

```text
lib/pricing.ts
app/order/BookingConfigurator.tsx
app/cart/CartClient.tsx
```

The corrected rule is:

```text
MONTHLY QUALIFICATION
Complete calendar month, including February
OR 30–31 inclusive calendar days

THEN APPLY HOLIDAY ADJUSTMENT
Tarifa Mensual − (Tarifa Mensual ÷ 31 × closed holidays)

EXACT-DATE PREMIUM
Not applied to monthly or complete multi-month buys
```

After replacing the files:

```bash
npm run dev
```

Test a 30-day range containing a holiday and a complete February.
Both must remain monthly buys with no exact-date premium.
