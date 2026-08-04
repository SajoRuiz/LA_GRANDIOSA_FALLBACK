# Pricing Test Matrix — Revision 3

Use a hypothetical `Tarifa Mensual` of `$3,100` for easy verification.

## Test 1 — 29 days, no holiday

```text
Billable days: 29
Subtotal: $3,100 ÷ 31 × 29 = $2,900
Premium: $290
Total: $3,190
Pricing basis: Daily proration
```

## Test 2 — 29 selected days with one closed holiday

```text
Operating/billable days: 28
Subtotal: $3,100 ÷ 31 × 28 = $2,800
Premium: $280
Total: $3,080
Pricing basis: Daily proration
```

## Test 3 — 30 selected days with one closed holiday

```text
Gross monthly price: $3,100
Holiday subtraction: $100
Premium: Not applied — monthly rule
Total: $3,000
Pricing basis: Monthly buy
```

The holiday does not reduce the range to a 29-day partial purchase.

## Test 4 — Complete February with no holiday

```text
Gross monthly price: $3,100
Holiday subtraction: $0
Premium: Not applied — monthly rule
Total: $3,100
Pricing basis: Monthly buy
```

## Test 5 — Complete month with two closed holidays

```text
Gross monthly price: $3,100
Holiday subtraction: $200
Premium: Not applied — monthly rule
Total: $2,900
Pricing basis: Monthly buy
```

## Test 6 — Two complete months with two total closed holidays

```text
Gross subtotal: $6,200
Holiday subtraction: $200
Adjusted subtotal: $6,000
Exact-date premium: $0
Multi-month discount: $600
Total: $5,400
Pricing basis: 2-month buy
```
