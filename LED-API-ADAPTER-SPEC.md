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

## Contractor specs received (2026-08-11)

Available source documents:

- NovaLCT LED Configuration Tool for Synchronous Control System User Manual V5.8.0
- Document process for Backing up Data and Configuration
- Network Security Diagram including methods of authentication into CMSPlayer and Remote Access process
- Document process for Firmware and Software Updates

What is now confirmed from these specs:

- Platform family: NovaStar / VNNOX / CMS-style ecosystem.
- Operational model includes:
	- Screen configuration
	- Firmware program updates
	- Backup/restore style configuration workflows
	- Cloud-connected operations over encrypted transport (HTTPS/SSL references in security document)
- Security direction is compatible with Stage 7 controls:
	- Authenticated access
	- Cloud security posture documentation
	- Remote-access governance considerations

What is still missing for direct API implementation:

- No explicit machine API endpoint list for campaign submit/status/cancel.
- No concrete auth scheme for server-to-server integration (API key format, OAuth, HMAC signing, token TTL, key rotation).
- No request/response schema for campaign create/update/delete.
- No provider status webhook contract (payload, signature verification, retry rules).
- No provider-side idempotency key contract.
- No published rate-limit values for automation workers.
- No confirmed mapping from provider statuses to internal statuses.

## Stage 7 implementation gate

The repository now has Stage 7 scaffolding on branch `stage-7-led-api`.
Before enabling `LED_PROVIDER_MODE=api`, obtain a provider API pack containing:

1. Base URL(s): sandbox and production.
2. Authentication method and credential provisioning flow.
3. Endpoint definitions for submit/status/cancel.
4. JSON schema examples for requests and responses.
5. Webhook event contract and signature verification method.
6. Idempotency strategy and duplicate handling rules.
7. Error code matrix and retry recommendations.
8. Throughput/rate limits and batching limits.

Until this package is received and tested, keep production in manual mode.
