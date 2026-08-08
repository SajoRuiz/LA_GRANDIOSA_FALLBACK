#!/usr/bin/env bash
set -euo pipefail

required=(
  "app/admin/purchase-orders/page.tsx"
  "app/admin/invoices/page.tsx"
  "app/admin/remittance/page.tsx"
  "app/portal/orders/page.tsx"
  "app/portal/invoices/page.tsx"
  "app/api/purchase-orders/upload-url/route.ts"
  "app/api/admin/invoices/issue/route.ts"
  "app/api/invoices/[invoiceId]/pdf/route.ts"
  "lib/server/invoice-pdf.ts"
  "lib/server/procurement.ts"
  "supabase/migrations/202608080001_stage_3b_c_po_invoicing_remittance.sql"
)

for file in "${required[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing: $file"
    exit 1
  fi
done

if ! npm ls pdf-lib >/dev/null 2>&1; then
  echo "Missing dependency: pdf-lib"
  echo "Run: npm install pdf-lib"
  exit 1
fi

echo "Stage 3B-C files and pdf-lib dependency are present."
