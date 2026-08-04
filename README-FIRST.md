# Install Stage 2B — Revision 2

## If Stage 2A or the first Stage 2B package is already installed

Replace:

```text
app/order/
app/cart/
data/
lib/
```

The browser-cart storage key remains `v2`, so any old Daypart-based test items
will not appear in the full-day cart.

## If no commerce package is installed

Copy the same folders into the root of the existing Next.js project.

## Homepage

The existing PLACE ORDER buttons should continue pointing to:

```text
/order
```

## Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000/order
http://localhost:3000/cart
```

## Required tests

1. 1–29 days with no closure:
   - daily proration;
   - 10% exact-date premium.

2. 1–29 days containing a closed holiday:
   - closed date shows 0 hours;
   - closed date is excluded from partial billable days.

3. 30- or 31-day monthly buy containing closed holidays:
   - gross price begins at Tarifa Mensual;
   - one Tarifa Mensual ÷ 31 amount is subtracted per closed holiday;
   - no 10% exact-date premium.

4. Complete February:
   - monthly buy;
   - holiday subtraction applies when relevant;
   - no exact-date premium.

5. Two or more complete calendar months:
   - gross price = Tarifa Mensual × complete months;
   - monthly holiday subtractions are deducted;
   - 10% multi-month discount applies to the adjusted subtotal.

6. More than 31 days without full calendar-month boundaries:
   - blocked.

7. Multiple combinations in one contract:
   - holiday deductions, premiums, and discounts calculate per item;
   - contract totals combine all adjustments.
