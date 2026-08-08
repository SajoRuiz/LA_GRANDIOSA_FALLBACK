#!/usr/bin/env bash
set -euo pipefail

required=(
  "app/admin/notifications/page.tsx"
  "app/admin/deadlines/page.tsx"
  "app/api/internal/notifications/process/route.ts"
  "app/api/internal/reminders/process/route.ts"
  "app/api/internal/automation/daily/route.ts"
  "app/api/webhooks/resend/route.ts"
  "app/api/webhooks/twilio/status/route.ts"
  "lib/server/notification-delivery.ts"
  "lib/server/reminder-automation.ts"
  "supabase/migrations/202608100001_stage_5_communications_automation.sql"
)

for file in "${required[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing: $file"
    exit 1
  fi
done

if ! npm ls resend twilio >/dev/null 2>&1; then
  echo "Missing dependency: resend and/or twilio"
  echo "Run: npm install resend twilio"
  exit 1
fi

echo "Stage 5 communications and automation files are present."
