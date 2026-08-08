# Stage 4 Test Matrix

1. Issue an invoice so the order status becomes `awaiting_assets`.
2. Open `/portal/orders/[orderId]/assets` as the agency buyer.
3. Confirm screen slots match the package:
   - Center = one Center slot
   - Left + Right = two slots
   - All 3 Screens = Left, Center, Right
4. Select a local image/video and confirm the preview appears before upload.
5. Upload a file larger than 6 MB and confirm resumable progress is visible.
6. Confirm upload registration creates `asset_files` version 1.
7. Upload a replacement and confirm version 2 exists without deleting version 1.
8. Confirm an upload-receipt notification is queued.
9. Complete all required slots and click `Submit final assets for review`.
10. Confirm order becomes `under_review` and a final receipt + internal review notification are queued.
11. Open `/admin/assets` as `sales_reviewer` or `system_admin`.
12. Preview each image/video and download the original.
13. Request revision for one screen; confirm other screens become approved and the selected screen becomes `revision_requested`.
14. Upload a new version for the revised slot and resubmit.
15. Approve all assets; confirm order becomes `release_pending` and a release queue row is created.
16. Open `/admin/releases`; mark released, then live.
17. Confirm corresponding order status and notification records.
18. Add Resend/Twilio credentials and use `/admin/notifications` to send queued messages.
19. Confirm Resend/Twilio provider IDs and statuses are stored in `notification_outbox`.
