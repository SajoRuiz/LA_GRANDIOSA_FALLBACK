# LED Screen API Adapter Specification

## Current mode

```env
LED_PROVIDER_MODE=manual
```

Manual release remains authoritative until the operator supplies and certifies
its API.

## Application contract

The adapter is defined under:

```text
lib/led/
```

Required operations:

```ts
submitCampaign(release)
getCampaignStatus(externalReference)
cancelCampaign(externalReference)
```

## Required provider information

Before enabling API mode, obtain:

- Sandbox and Production base URLs
- Authentication method
- IP allowlisting requirements
- Request signing requirements
- Campaign create/update/cancel endpoints
- File-ingestion method
- Maximum asset sizes
- Pixel specifications
- Video codecs and frame rates
- Audio handling
- Start/end time-zone rules
- Idempotency behavior
- Status list and status webhook format
- Error and retry behavior
- Rate limits
- Support/escalation contact
- Certification requirements

## Internal status mapping

```text
release_pending
submitted
acknowledged
released
live
failed
cancelled
```

## Security

- API credentials remain server-only.
- Asset links must be short-lived signed URLs.
- Every provider response is recorded.
- Idempotency is required for submission.
- `live` is set only after provider acknowledgment or independent verification.
- Manual fallback remains available.

## Enabling API mode

Only after certification:

```env
LED_PROVIDER_MODE=api
LED_PROVIDER_API_BASE_URL=https://provider.example
LED_PROVIDER_API_KEY=server-only-secret
```

Update `HttpLedScreenProvider` to match the confirmed provider contract.
