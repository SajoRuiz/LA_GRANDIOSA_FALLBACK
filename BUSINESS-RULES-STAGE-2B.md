# Locked Commerce Rules — Stage 2B, Revision 2

## Full-day ordering

- The Daypart selector is removed.
- Every selected advertising combination receives a full operating day.
- A standard operating day contains 12 screen hours.
- An approved extended-hours date contains 14 screen hours.
- A closed holiday contains 0 screen hours.

Removing Daypart collapses the workbook-backed ordering matrix from 80 to
40 selectable full-day combinations:

```text
4 durations × 2 formats × 5 screen packages = 40
```

The 40 combinations use the Prime `Tarifa Mensual` source rows because those
match the rates already published on the La Grandiosa website.

## Closed holidays

The service calendar closes on:

- December 25
- January 1
- Thanksgiving
- Good Friday
- Mother's Day
- Father's Day
- January 6
- General Election Day

One-time closures and special elections can be added in:

```text
lib/service-calendar.ts
ADDITIONAL_CLOSED_DATES
```

## Extended hours

Extended dates receive two additional hours:

```text
12 standard hours + 2 hours = 14 hours
```

No specific extended-hour dates were supplied yet. Add approved dates in:

```text
lib/service-calendar.ts
EXTENDED_SERVICE_DATES
```

## Partial campaign pricing: 1–29 days

Closed holidays are excluded from billable operating days.

```text
Billable days = operating days, excluding closed holidays
Media subtotal = Tarifa Mensual ÷ 31 × billable days
Date selection premium = 10% of media subtotal
Line total = media subtotal + premium
```

Extended hours are included and do not add a separate price premium.

## One monthly buy

Either of the following counts as one monthly buy:

- a complete calendar month, including February; or
- any rolling 30- or 31-day selection.

The monthly calculation starts from `Tarifa Mensual` and subtracts one
31-day daily-rate amount for each closed holiday in the selected range.

```text
Daily holiday subtraction = Tarifa Mensual ÷ 31
Closed-holiday subtraction = daily holiday subtraction × closed holidays
Adjusted monthly subtotal = Tarifa Mensual − closed-holiday subtraction
Date selection premium = $0
Line total = adjusted monthly subtotal
```

The 10% exact-date premium does not apply to the monthly holiday subtraction.

## Complete multi-month buy

A full multi-month selection is defined as:

- start date is the first day of a calendar month;
- end date is the final day of a later calendar month; and
- the range contains at least two complete calendar months.

The system applies the closed-holiday subtraction month by month, then applies
the 10% multi-month discount to the adjusted total.

```text
Gross subtotal = Tarifa Mensual × complete calendar months
Closed-holiday subtraction = sum of each month's holiday subtraction
Adjusted subtotal = gross subtotal − closed-holiday subtraction
Multi-month discount = 10% of adjusted subtotal
Line total = adjusted subtotal − multi-month discount
```

## Unsupported long partial ranges

A selection longer than 31 days that does not begin on the first of a month
and end on the final day of a later month is blocked until a mixed
month-plus-partial-month formula is approved.
