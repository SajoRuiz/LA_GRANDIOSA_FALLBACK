# Pricing Test Matrix — Revision 4

Use one SKU and one known `Tarifa Mensual` to verify each scenario.

| Inclusive days / range | Expected pricing |
|---|---|
| 1–29 days | Partial proration + 10% premium |
| Complete February | 1 monthly unit; no premium |
| 30 days | 1 monthly unit; no premium |
| 31 days | 1 monthly unit; no premium |
| 32 days | 1 monthly unit + 1 partial day |
| 59 days | 1 monthly unit + 28 partial days |
| 60 days | 2 monthly units; 10% multi-month discount |
| 61 days | 2 monthly units; 10% multi-month discount |
| 62 days | 2 monthly units + 1 partial day; no multi-month discount |
| 89 days | 2 monthly units + 28 partial days |
| 90 days | 3 monthly units; 10% multi-month discount |
| 91 days | 3 monthly units; 10% multi-month discount |
| 92 days | 3 monthly units + 1 partial day; no multi-month discount |
| Complete two calendar months | 2 monthly units; 10% discount |
| Any range containing holidays | Holiday deductions; premium only on partial operating subtotal |
| Range containing no operating days | Blocked |

## Visible calendar QA

- Calendar panel is visible before a date is selected.
- Desktop shows two months.
- Mobile shows one month.
- Clicking once selects the start date.
- Clicking again selects the end date.
- The selected range is highlighted.
- Previous, Today, Next, and Clear Dates controls work.
- Native date inputs remain available and their calendar icons are visible.
