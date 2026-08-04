# Pricing Correction — 30/31-Day Monthly Buy

Replace these files in the existing Stage 2A installation:

```text
lib/pricing.ts
app/order/BookingConfigurator.tsx
app/cart/CartClient.tsx
```

The corrected rule is:

```text
1–29 inclusive days:
(Tarifa Mensual ÷ 31 × days) + 10%

30 or 31 inclusive days:
Tarifa Mensual exactly
No 10% premium
```

Campaign ranges longer than 31 days are blocked temporarily because a
multi-month pricing rule has not yet been provided.

After replacing the files:

```bash
npm run dev
```

Test one 29-day campaign, one 30-day campaign, and one 31-day campaign.
