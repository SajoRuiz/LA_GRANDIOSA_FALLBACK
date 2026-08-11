# Stage 7 Contractor Request — LED API Integration Packet

## Request purpose

La Grandiosa Commerce is integrating direct LED screen campaign control in Stage 7.
To complete a secure and certified integration, please provide the full API
contract and onboarding package below.

## Required delivery checklist

1. Environments
- Sandbox base URL
- Production base URL
- Any IP allowlist requirements for both environments

2. Authentication
- Authentication model (API key, OAuth2, HMAC signature, mTLS, etc.)
- Credential issuance process
- Token/key lifetime
- Key rotation and revocation process
- Required headers

3. Campaign API endpoints
- Create/submit campaign endpoint
- Get campaign status endpoint
- Cancel campaign endpoint
- Update campaign endpoint (if supported)
- Endpoint path, method, and query parameters for each

4. Request/response schemas
- JSON schema or OpenAPI spec
- Example payloads for success and failure cases
- Required fields, field constraints, enums, and date/time format
- Timezone rules for campaign start/end windows

5. Asset ingestion requirements
- Asset URL ingestion method (pull signed URL vs direct upload)
- Max file size
- Accepted codecs/containers
- Accepted dimensions/frame rates
- Audio policy

6. Status and webhooks
- Full status lifecycle values
- Webhook URL registration process
- Webhook event schema
- Signature validation method for webhook requests
- Webhook retry policy and duplicate delivery behavior

7. Reliability and limits
- Idempotency requirements and supported keys/headers
- Rate limits and burst limits per endpoint
- Backoff/retry recommendations
- Error code catalog with remediation guidance

8. Security and operations
- Network and remote access requirements
- Audit logging expectations
- Backup and restore process for campaign state
- Firmware/software update windows that may impact API availability

9. Certification and support
- Sandbox certification checklist
- Production go-live checklist
- Escalation contacts and SLA

## Response format requested

Please provide one of the following:
- OpenAPI/Swagger file plus operational runbook, or
- API PDF + JSON examples + webhook signing documentation

## Current implementation expectation

Until the above is delivered and validated, production remains in:
- LED_PROVIDER_MODE=manual
