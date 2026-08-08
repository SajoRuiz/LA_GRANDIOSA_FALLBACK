# Notification Outbox — Stage 3A

Stage 3A creates queued records only. Delivery workers arrive in Stage 3B.

## Queued when client information is saved

### Customer email

```text
template_key: customer_client_information_received
recipient: client email
sender: orders@lagrandiosapr.com
reply-to: ventas@lagrandiosapr.com
```

### Internal processing email

```text
template_key: internal_new_order_received
recipient: processing@lagrandiosapr.com
sender: orders@lagrandiosapr.com
reply-to: ventas@lagrandiosapr.com
```

### Customer SMS — only with consent

```text
template_key: customer_order_received_sms
recipient: client telephone
```

## Future Stage 3B templates

- customer_contract_ready
- customer_card_payment_confirmed
- customer_ach_processing
- customer_ach_confirmed
- customer_ach_failed
- customer_client_code_pending
- customer_client_code_approved
- customer_client_code_declined
- internal_payment_confirmed
- internal_client_code_approval_required
- customer_asset_upload_access

## Future Stage 4 templates

- customer_asset_upload_received
- internal_asset_review_required
- customer_revision_requested
- customer_asset_approved
- customer_final_asset_receipt
- internal_release_ready
