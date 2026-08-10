# Incident Response Runbook

## Severity

- Critical: unauthorized access, bank-data exposure, service-role exposure,
  fraudulent invoice/remittance change, or asset release to the wrong screen.
- High: privileged account compromise, broad outage, invoice corruption,
  persistent notification failure, or cross-agency data access.
- Medium: isolated failed upload, delayed notification, or recoverable
  operational error.

## Immediate actions

1. Record the incident time and owner.
2. Preserve logs and audit records.
3. Disable the affected account, route, provider, or release.
4. Rotate exposed secrets.
5. Stop automated jobs when they could worsen the incident.
6. Assess affected agencies, orders, invoices, assets, and releases.
7. Notify internal leadership and legal/privacy contacts.
8. Communicate to clients only from approved channels.

## Banking fraud warning

La Grandiosa must never accept a remittance-account change solely by email.
Any change requires authenticated finance administration and an independent
verification call.

## Recovery

- Correct the cause.
- Validate access controls.
- Restore data if needed.
- Run Stage 6 security and smoke tests.
- Save an audit snapshot.
- Obtain production signoff before reopening.

## Post-incident

Document timeline, impact, root cause, actions, credential rotations, client
communication, and prevention measures.
