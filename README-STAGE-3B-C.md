# La Grandiosa Commerce — Stage 3B-C

## Scope

Stage 3B-C adds the initial PO and invoice workflow for approved agency-credit
customers:

- Private purchase-order PDF upload
- Versioned PO repository
- Processing-team PO approval, revision request, or decline
- Secure remittance-account administration
- Invoice creation after PO and credit approval
- Invoice PDF generation
- Agency invoice center
- Manual ACH, wire, check, or other payment recording
- Partial- and full-payment balances
- Credit-ledger conversion from order hold to invoice exposure
- Notification-outbox records for PO, invoice, and payment events

Actual Resend email delivery, Twilio SMS delivery, and asset uploads are not
activated in this release.

## 1. Install the patch

Copy the contents of the Stage 3B-C patch into the root of the existing
LaGrandiosa project. Allow it to replace the listed Stage 3B-B files.

## 2. Install the PDF dependency

```bash
npm install pdf-lib
```

## 3. Verify the files

```bash
bash VERIFY-STAGE-3B-C.sh
```

## 4. Apply only the Stage 3B-C migration

Run this file in the Supabase SQL Editor:

```text
supabase/migrations/202608080001_stage_3b_c_po_invoicing_remittance.sql
```

Do not rerun Stage 3A, Stage 3B-A, or Stage 3B-B.

The migration creates a private `purchase-orders` Storage bucket and enables
Supabase Vault for encrypted routing and account numbers.

## 5. Restart the application

```bash
rm -rf .next
npm run dev
```

## 6. Health check

Open:

```text
http://localhost:3000/api/health/commerce
```

Expected highlights:

```json
{
  "ok": true,
  "stage": "3B-C",
  "database": "ready",
  "purchaseOrders": "active",
  "invoicing": "active",
  "remittanceVault": "active",
  "purchaseOrderStorage": "ready"
}
```

## 7. Add the existing business bank account

Sign in as a `finance` or `system_admin` user with MFA, then open:

```text
http://localhost:3000/admin/remittance
```

Enter the real business-bank details there. Do not place routing or account
numbers in source code, `.env.local`, GitHub, screenshots, email, or chat.

The system stores the complete values as encrypted Supabase Vault secrets. The
normal table stores only the encrypted-secret IDs and the account's last four
digits.

Creating a new active remittance account automatically makes the previous
account inactive. Existing invoices retain the remittance-account snapshot they
were issued with.

## 8. Agency PO workflow

Agency users open:

```text
/portal/orders
/portal/orders/[orderId]/purchase-order
```

The PO must be a PDF no larger than 15 MB. Every accepted revision is retained.

Internal processing opens:

```text
/admin/purchase-orders
```

Available decisions:

- Approve PO
- Request revision
- Decline PO

A PO cannot be approved while its agency credit exception remains pending or
has been declined.

## 9. Invoice workflow

After PO approval, finance opens:

```text
/admin/invoices
```

Finance selects the approved order and active remittance account, then issues
the invoice.

Invoice issuance:

- Creates an `LG-INV-YYYY-######` invoice number
- Uses the agency's payment terms for the due date
- Copies the order items into invoice lines
- Converts the active credit hold into invoice-ledger exposure
- Opens the order's future asset-submission status
- Queues customer and internal invoice notifications

## 10. Agency invoice center

Agency users open:

```text
/portal/invoices
/portal/invoices/[invoiceId]
```

The authenticated invoice shows secure remittance details and provides a PDF
download. Banking instructions are not shown on the public website.

## 11. Record payments

Finance records a partial or full payment at:

```text
/admin/invoices
```

Supported initial methods:

- ACH
- Wire
- Check
- Other manual payment

The payment updates:

- Invoice paid amount
- Invoice balance
- Invoice status
- Agency credit ledger
- Order payment status
- Audit log
- Notification outbox

## Security notes

- Purchasing and finance routes require an authenticated AAL2 MFA session.
- PO files are stored in a private bucket.
- Signed URLs are short-lived.
- Banking values are stored in Vault, not public tables.
- Only server-side service-role routes can retrieve full remittance details.
- Notification messages are queued only; delivery is a future stage.

## Tax treatment

Stage 3B-C continues using the existing `tax_cents = 0` value. Confirm the production tax rule with the company accountant before launch.
