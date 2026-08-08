# Stage 3B-C Test Matrix

## Setup

- [ ] `npm install pdf-lib` completed
- [ ] Stage 3B-C SQL migration completed
- [ ] Health check says `stage: 3B-C`
- [ ] `purchaseOrderStorage` says `ready`
- [ ] Finance or system-admin user has AAL2 MFA

## Bank remittance

1. Open `/admin/remittance`.
2. Add a test or approved business bank account.
3. Confirm the account register shows only the last four digits.
4. Confirm a second active account makes the previous one inactive.
5. Do not use real bank details until the environment is secured and reviewed.

## Purchase order

1. Create an agency order within approved credit.
2. On the confirmation page, click `Upload purchase order`.
3. Upload a PDF under 15 MB.
4. Confirm the PO status becomes `submitted`.
5. Confirm a customer notification and internal review notification are queued.
6. Confirm the PDF downloads through a short-lived signed URL.
7. Request a revision and upload a second version.
8. Confirm both versions remain in the repository.
9. Approve the final PO.

## Credit dependency

1. Create an order above available credit.
2. Upload its PO.
3. Confirm PO approval is blocked while credit is pending.
4. Approve the credit exception at `/admin/credit`.
5. Confirm PO approval then succeeds.

## Invoice

1. Add an active remittance account.
2. Open `/admin/invoices`.
3. Issue the approved invoice.
4. Confirm the invoice number starts with `LG-INV-`.
5. Confirm the due date reflects the agency payment terms.
6. Confirm the order becomes `awaiting_assets`.
7. Confirm the credit hold is released and an invoice ledger entry is created.
8. Confirm the agency sees the invoice at `/portal/invoices`.
9. Confirm the PDF downloads.
10. Confirm secure bank instructions appear only after authentication.

## Payments

1. Record a partial ACH payment.
2. Confirm invoice status becomes `partially_paid`.
3. Confirm the balance is reduced.
4. Record the remaining payment.
5. Confirm invoice status becomes `paid`.
6. Confirm the ledger receives negative payment entries.
7. Confirm the agency's available credit increases accordingly.

## Notifications and audit

Confirm rows are created in:

- `notification_outbox`
- `audit_log`
- `order_status_history`
- `invoice_status_history`

This release queues messages but does not send them.
