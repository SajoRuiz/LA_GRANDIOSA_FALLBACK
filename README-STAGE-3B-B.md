# La Grandiosa Commerce — Stage 3B-B

## Release objective

Activate negotiated agency pricing and approved-credit controls before the PO
and invoice workflow.

## What is active

- Agency discount policy calculations
- Published total versus negotiated agency total
- Approved credit-limit summaries
- Credit ledger exposure
- Active order credit holds
- Credit exception review queue
- Finance approval or decline
- Manual opening-balance and credit adjustments
- Agency credit display in the secure portal
- Credit projection in the contract cart
- Server-side recalculation at order creation

## Discount policies

### Stack

The campaign discount is applied first. The negotiated agency percentage is
then applied to the public published total.

### Best of

The system compares the available campaign discount with the negotiated agency
discount calculated on the pre-discount total and applies the larger one.

### Agency replaces campaign

The campaign discount is removed and the negotiated agency discount is applied
to the pre-discount total.

Holiday deductions and date-selection premiums are pricing adjustments, not
agency discounts, and remain in the calculation.

## Credit formula

```text
Approved credit limit
- positive ledger exposure
- active order holds
= available credit
```

Pending exception requests are displayed separately and do not reduce available
credit until approved.

## Order behavior

Within-limit orders create an active seven-day credit hold.

Above-limit orders create:

```text
credit_status = review_required
hold_status = pending_exception
finance review record
```

Finance or system administrators review exceptions at:

```text
/admin/credit
```

## Next stage

Stage 3B-C adds:

- PO number and PDF upload
- PO review and correction requests
- Invoice records and numbering
- Invoice PDF
- Secure bank remittance instructions
- Manual and partial payment recording
- Due dates and aging
- Payment-confirmation notifications
