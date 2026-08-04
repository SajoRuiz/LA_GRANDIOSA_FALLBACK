# Locked Commerce Rules — Stage 2B, Revision 3

## Full-day ordering

- The Daypart selector is removed.
- Every selected advertising combination receives a full operating day.
- A standard operating day contains 12 screen hours.
- An approved extended-hours date contains 14 screen hours.
- A closed holiday contains 0 screen hours.

The source-backed customer matrix contains 40 selectable full-day combinations:

```text
4 durations × 2 formats × 5 screen packages = 40
```

The combinations use the Prime `Tarifa Mensual` rows because those match the
rates already published on the La Grandiosa website.

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

## Partial campaign pricing: 1–29 days

Closed holidays are excluded from billable operating days.

```text
Billable days = operating days, excluding closed holidays
Media subtotal = Tarifa Mensual ÷ 31 × billable days
Date selection premium = 10% of media subtotal
Line total = media subtotal + premium
```

## One monthly buy

Either of the following counts as one monthly buy:

- one complete calendar month, including February; or
- any rolling 30- or 31-day selection.

Monthly qualification is determined from the original selected calendar range
before any holiday adjustment.

```text
Gross monthly price = Tarifa Mensual
Daily holiday subtraction = Tarifa Mensual ÷ 31
Closed-holiday subtraction = daily holiday subtraction × closed holidays
Adjusted monthly subtotal = Tarifa Mensual − closed-holiday subtraction
Date selection premium = $0
Line total = adjusted monthly subtotal
```

A holiday subtraction never changes the purchase from monthly to partial and
never activates the 10% exact-date premium. This is the same principle that
allows a complete February to remain a monthly buy despite having 28 or 29
calendar days.

## Complete multi-month buy

A full multi-month selection:

- starts on the first day of a calendar month;
- ends on the final day of a later calendar month; and
- contains at least two complete calendar months.

```text
Gross subtotal = Tarifa Mensual × complete calendar months
Closed-holiday subtraction = sum of each month's holiday subtraction
Adjusted subtotal = gross subtotal − closed-holiday subtraction
Exact-date premium = $0
Multi-month discount = 10% of adjusted subtotal
Line total = adjusted subtotal − multi-month discount
```

## Unsupported long partial ranges

A selection longer than 31 days that does not begin on the first of a month
and end on the final day of a later month remains blocked until a mixed
month-plus-partial-month formula is approved.
