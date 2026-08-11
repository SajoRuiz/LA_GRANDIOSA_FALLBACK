# Stage 7 Setup — LED API Automation and Simulator

## 1. Preserve Stage 6

```bash
git add .
git commit -m "Complete Stage 6 production launch"
git push
git switch stage-7-led-api
```

## 2. Add local Stage 7 variables

Add the following to `.env.local` for simulator testing:

```env
LED_PROVIDER_MODE=api
LED_PROVIDER_API_BASE_URL=http://localhost:3000/api/internal/led/simulated-provider
LED_PROVIDER_API_KEY=local-test-key
LED_PROVIDER_WEBHOOK_SECRET=local-webhook-secret
```

Never commit `.env.local`.

## 3. Apply Stage 7 migrations

Run these through the Supabase SQL Editor for the branch test backend:

```text
supabase/migrations/202608110002_stage_7_led_api_release_statuses.sql
supabase/migrations/202608110003_stage_7_led_provider_simulator.sql
```

If you cannot apply them yet, the local simulator can still run using the
file-backed fallback store.

## 4. Start local app

```bash
rm -rf .next
npm run dev
```

If port 3000 is busy, Next.js will move to 3001 automatically.

## 5. Run simulator smoke

```bash
SIM_BASE_URL=http://localhost:3000 \
SIM_API_KEY=local-test-key \
LED_PROVIDER_WEBHOOK_SECRET=local-webhook-secret \
node scripts/led-simulator-smoke.mjs
```

Update `SIM_BASE_URL` if Next.js starts on a different port.

## 6. Run queue-linked webhook e2e smoke

This validates the full local transition path using a seeded release row tied to
real `orders`, `asset_submissions`, and `asset_release_queue` records.

```bash
SIM_BASE_URL=http://localhost:3000 \
CRON_SECRET=your-cron-secret \
LED_PROVIDER_WEBHOOK_SECRET=local-webhook-secret \
node scripts/led-release-queue-e2e.mjs
```

Expected final output includes:

- `snapshot-after-released` with `queueStatus = released` and `orderStatus = released`
- `snapshot-after-live` with `queueStatus = live` and `orderStatus = live`

## 7. Manual admin validation

Open:

```text
/admin/releases
```

In API mode, verify the UI shows:

- Submit to provider
- Sync provider status
- Cancel provider campaign
- Existing manual release controls preserved

## 8. Build validation

Run this only when the dev server is stopped to avoid `.next` collisions:

```bash
rm -rf .next
npm run build
```