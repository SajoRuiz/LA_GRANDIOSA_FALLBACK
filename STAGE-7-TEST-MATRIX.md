# Stage 7 Test Matrix

## Simulator submit flow

1. Start the app with `LED_PROVIDER_MODE=api` and simulator base URL.
2. Run `node scripts/led-simulator-smoke.mjs`.
3. Confirm `submit` returns:
   - `providerKey = simulated_led_provider`
   - `status = submitted`
   - a non-empty `externalReference`

## Simulator status flow

1. After submit, confirm `status` returns `submitted`.
2. Confirm the returned `externalReference` matches the submit step.

## Simulator transition flow

1. Confirm the smoke script can move the campaign to `released`.
2. Confirm the response message matches the simulated release note.

## Simulator cancel flow

1. Confirm the smoke script can cancel the campaign.
2. Confirm the final response returns `status = cancelled`.

## Webhook scaffold behavior

1. POST to `/api/webhooks/led/status` without `x-led-signature`.
2. Confirm HTTP 401.
3. POST with incorrect signature.
4. Confirm HTTP 401.
5. POST with valid signature and a non-existent external reference.
6. Confirm a clear not-found style error response.

## Admin release UI

1. Open `/admin/releases` with API mode enabled.
2. Confirm API-mode controls are visible.
3. Confirm manual controls remain visible for fallback.

## Worker route

1. POST to `/api/internal/releases/process` with cron authorization.
2. Confirm the route returns a structured result.
3. In manual mode, confirm it reports a skipped LED provider run.
4. In API mode, confirm it attempts queue processing.

## Queue-linked webhook transition (seeded)

1. Start app in API mode with simulator base URL.
2. Run `node scripts/led-release-queue-e2e.mjs` with `CRON_SECRET` and `LED_PROVIDER_WEBHOOK_SECRET`.
3. Confirm the script logs `seed` with a real `releaseId`.
4. Confirm worker processing assigns a non-empty `externalReference`.
5. Confirm `snapshot-after-released` reports:
   - `queueStatus = released`
   - `orderStatus = released`
6. Confirm `snapshot-after-live` reports:
   - `queueStatus = live`
   - `orderStatus = live`
7. Confirm final `ok` output includes the same `releaseId` and resolved `externalReference`.

## Clean build

1. Stop the dev server.
2. Remove `.next`.
3. Run `npm run build`.
4. Confirm the build completes successfully.