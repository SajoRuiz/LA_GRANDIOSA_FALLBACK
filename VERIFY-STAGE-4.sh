#!/usr/bin/env bash
set -euo pipefail
required=(
  "app/portal/orders/[orderId]/assets/page.tsx"
  "app/admin/assets/page.tsx"
  "app/admin/releases/page.tsx"
  "app/admin/notifications/page.tsx"
  "app/api/assets/upload-token/route.ts"
  "app/api/assets/register/route.ts"
  "app/api/assets/submit/route.ts"
  "app/api/admin/assets/[submissionId]/review/route.ts"
  "lib/server/assets.ts"
  "lib/server/notification-delivery.ts"
  "supabase/migrations/202608090001_stage_4_assets_notifications.sql"
)
for file in "${required[@]}"; do [[ -f "$file" ]] || { echo "Missing: $file"; exit 1; }; done
for dep in tus-js-client resend twilio; do npm ls "$dep" >/dev/null 2>&1 || { echo "Missing dependency: $dep"; exit 1; }; done
echo "Stage 4 files and dependencies are present."
