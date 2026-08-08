#!/usr/bin/env bash
set -euo pipefail

required=(
  "middleware.ts"
  "lib/agency-pricing.ts"
  "lib/server/agency-credit.ts"
  "app/admin/credit/page.tsx"
  "app/admin/credit/CreditAdminClient.tsx"
  "app/api/admin/credit-reviews/[reviewId]/route.ts"
  "app/api/admin/agencies/[agencyId]/credit-ledger/route.ts"
  "supabase/migrations/202608070002_stage_3b_b_agency_pricing_credit.sql"
)

for file in "${required[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing: $file"
    exit 1
  fi
done

echo "Stage 3B-B files are present."
