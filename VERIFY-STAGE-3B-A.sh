#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f package.json || ! -d app || ! -d lib ]]; then
  echo "Run this script from the LaGrandiosa project root."
  exit 1
fi

required=(
  "proxy.ts"
  "app/auth/login/page.tsx"
  "app/auth/callback/route.ts"
  "app/auth/activate/page.tsx"
  "app/auth/mfa/enroll/page.tsx"
  "app/auth/mfa/challenge/page.tsx"
  "app/portal/page.tsx"
  "app/admin/agencies/page.tsx"
  "app/api/admin/agencies/route.ts"
  "app/api/admin/agency-invites/route.ts"
  "app/api/auth/mfa/complete/route.ts"
  "lib/auth/access.ts"
  "lib/supabase/client.ts"
  "lib/supabase/server.ts"
  "lib/supabase/proxy.ts"
  "supabase/migrations/202608050001_stage_3b_a_agency_auth.sql"
)

missing=0
for file in "${required[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "MISSING: $file"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "Stage 3B-A is incomplete. Copy the missing paths before continuing."
  exit 1
fi

if ! npm ls @supabase/ssr >/dev/null 2>&1; then
  echo "MISSING DEPENDENCY: @supabase/ssr"
  echo "Run: npm install @supabase/ssr"
  exit 1
fi

echo "Stage 3B-A file structure and @supabase/ssr dependency are present."
echo "Next: apply the SQL migration, configure Supabase Auth, then run npm run build."
