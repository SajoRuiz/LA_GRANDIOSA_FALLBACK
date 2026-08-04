# Locked Pricing and Cart Rules

## Source rate

Use `Tarifa Mensual` from the `Tarifario Sin Audio` worksheet.

`Tarifa al 80%` remains stored but is not used for customer checkout.

## Date calculation

The start date and end date are both included.

Example:

```text
August 1 → August 31 = 31 billable days
```

## Pricing rule for 1–29 inclusive days

```text
Prorated base =
(Tarifa Mensual ÷ 31) × inclusive campaign days
```

Then:

```text
Date Selection Premium =
Prorated base × 10%
```

Finally:

```text
Line total =
Prorated base + Date Selection Premium
```

## Pricing rule for 30 or 31 inclusive days

Any 30- or 31-day selection is a monthly buy.

```text
Media subtotal = Tarifa Mensual
Date Selection Premium = $0
Line total = Tarifa Mensual
```

The 10% premium does not apply.

## Campaigns longer than 31 days

A multi-month pricing rule has not yet been provided.

To avoid charging an incorrect amount, this prototype blocks date ranges longer
than 31 inclusive days. The rule must be defined before multi-month purchases
are enabled.

## Rounding

All calculations are performed in integer cents and rounded to the nearest cent.

## Cart behavior

One contract can contain multiple advertising combinations.

Each combination remains its own cart line with:

- SKU
- Start date
- End date
- Inclusive day count
- Pricing basis
- Monthly rate
- Media subtotal
- Date selection premium
- Line total

Different date ranges within the same contract are supported.
