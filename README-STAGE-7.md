# La Grandiosa Commerce — Stage 7

## LED API Automation and Simulator Certification

Stage 7 adds:

- Release-queue orchestration for LED provider submission and status sync
- API-mode admin actions for submit, sync, and cancel
- Cron-safe LED release worker processing
- Secure LED status webhook scaffold
- Local simulated provider harness for pre-contractor validation
- Seeded internal test route for queue-linked webhook transition checks
- Contractor request packet for the real provider API contract

## New internal routes

```text
/api/internal/releases/process
/api/internal/releases/seed
/api/internal/releases/subscribe
/api/internal/led/simulated-provider/campaigns
/api/internal/led/simulated-provider/campaigns/[externalReference]
/api/internal/led/simulated-provider/campaigns/[externalReference]/status
```

## New webhook route

```text
/api/webhooks/led/status
```

## New environment variables

```env
LED_PROVIDER_MODE=manual
LED_PROVIDER_API_BASE_URL=
LED_PROVIDER_API_KEY=
LED_PROVIDER_API_SECRET=
LED_PROVIDER_WEBHOOK_SECRET=
LED_PROVIDER_PLAYER_IDS=
LED_PROVIDER_STATUS_PATH=v2/player/config/status
LED_PROVIDER_LOGS_PATH=v2/player/logs
LED_PROVIDER_SUBSCRIBE_PATH=v2/subscription/solution/change
```

For simulator testing only, set:

- `LED_PROVIDER_MODE=api`
- `LED_PROVIDER_API_BASE_URL=http://localhost:3000/api/internal/led/simulated-provider`
- `LED_PROVIDER_API_KEY=replace-with-local-simulator-api-key`
- `LED_PROVIDER_API_SECRET=replace-with-local-simulator-api-secret`
- `LED_PROVIDER_WEBHOOK_SECRET=replace-with-local-simulator-webhook-secret`

Generate local-only simulator secrets with a command such as `openssl rand -hex 16`
for the API key and `openssl rand -hex 32` for shared secrets.

## Webhook subscription registration

Use the internal route (or helper script) to register/refresh solution-change
subscriptions:

```text
POST /api/internal/releases/subscribe
```

Helper script:

```bash
CRON_SECRET=... node scripts/led-subscribe.mjs
```

Optional override:

- `LED_CALLBACK_URL=https://your-domain.example/api/webhooks/led/status?token=...`

## Important

Stage 7 remains isolated on the `stage-7-led-api` branch.

Do not enable production API mode until the contractor provides:

- authenticated API endpoint definitions
- request/response schemas
- webhook signing contract
- status mapping and retry behavior

Use [STAGE-7-CONTRACTOR-REQUEST.md](STAGE-7-CONTRACTOR-REQUEST.md) to request the missing provider packet.