# Twilio Setup — Stage 5

Platform: Twilio Console.

1. Create or open the La Grandiosa Twilio account.
2. Complete business verification and any required US messaging registration.
3. Create a Messaging Service for transactional order notifications.
4. Add the approved sender/phone number to the Messaging Service.
5. Copy the Account SID, Auth Token, and Messaging Service SID.
6. Configure the status callback URL as:

```text
https://www.lagrandiosapr.com/api/webhooks/twilio/status
```

Environment values:

```env
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=MG...
TWILIO_FROM_NUMBER=
TWILIO_STATUS_CALLBACK_URL=https://www.lagrandiosapr.com/api/webhooks/twilio/status
```

A direct `TWILIO_FROM_NUMBER` may be used instead of a Messaging Service during
controlled testing, but the Messaging Service is the recommended production
configuration.
