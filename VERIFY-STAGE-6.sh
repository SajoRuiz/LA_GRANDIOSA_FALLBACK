#!/usr/bin/env bash
set -euo pipefail

required=(
  "middleware.ts"
  "app/admin/security/page.tsx"
  "app/admin/launch/page.tsx"
  "app/api/health/production/route.ts"
  "app/api/admin/security/audit/route.ts"
  "app/api/admin/production-releases/route.ts"
  "app/api/internal/security/maintenance/route.ts"
  "lib/server/security.ts"
  "lib/server/request-context.ts"
  "lib/server/security-maintenance.ts"
  "lib/led/provider.ts"
  "scripts/check-for-secrets.mjs"
  "scripts/verify-production-env.mjs"
  "scripts/smoke-test.mjs"
  "supabase/migrations/202608110001_stage_6_production_security.sql"
)

for file in "${required[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing: $file"
    exit 1
  fi
done

if [[ -f "proxy.ts" ]]; then
  echo "Remove proxy.ts. This project uses Next.js 14 middleware.ts."
  exit 1
fi

if [[ ! -f ".env.local" ]]; then
  echo "Warning: .env.local is missing."
else
  if ! grep -q '^SECURITY_HASH_SALT=.' .env.local; then
    echo "Missing SECURITY_HASH_SALT in .env.local"
    exit 1
  fi
fi

node scripts/check-for-secrets.mjs

echo "Stage 6 production-security files are present."
