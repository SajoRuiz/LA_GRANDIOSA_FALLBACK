function money(value: unknown): string {
  const cents = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
}

export interface RenderedNotification {
  subject: string;
  text: string;
  html: string;
  sms: string;
}

export function renderNotification(templateKey: string, payload: Record<string, unknown>): RenderedNotification {
  const orderNumber = text(payload.orderNumber) || "your La Grandiosa order";
  const agencyName = text(payload.agencyName);
  const note = text(payload.reviewerNote || payload.reviewNote);
  const portalUrl = text(payload.portalUrl || payload.assetPortalUrl || payload.invoiceUrl);

  let subject = `La Grandiosa update — ${orderNumber}`;
  let heading = "La Grandiosa Order Update";
  let body = `There is an update for ${orderNumber}.`;

  const templates: Record<string, [string, string, string]> = {
    customer_agency_order_received: [
      `La Grandiosa order ${orderNumber} received`,
      "Agency Order Received",
      `Your order has been saved for ${agencyName || "your agency"}. The next step is purchase-order and credit processing.`,
    ],
    internal_new_agency_order_received: [
      `New La Grandiosa agency order ${orderNumber}`,
      "New Agency Order",
      `A new order has been submitted by ${agencyName || "an agency client"}.`,
    ],
    internal_credit_exception_review_required: [
      `Credit review required — ${orderNumber}`,
      "Credit Review Required",
      `The order exceeds currently available credit and requires finance review.`,
    ],
    customer_purchase_order_received: [
      `Purchase order received — ${orderNumber}`,
      "Purchase Order Received",
      `Your purchase-order PDF was received and is waiting for processing-team review.`,
    ],
    internal_purchase_order_review_required: [
      `PO review required — ${orderNumber}`,
      "Purchase Order Review Required",
      `A purchase-order document was submitted by ${agencyName || "an agency client"}.`,
    ],
    customer_purchase_order_approved: [
      `Purchase order approved — ${orderNumber}`,
      "Purchase Order Approved",
      `Your purchase order was approved. The invoice will be issued through the secure portal.`,
    ],
    customer_purchase_order_revision_requested: [
      `Purchase-order revision requested — ${orderNumber}`,
      "Purchase-Order Revision Requested",
      `The processing team requested a purchase-order revision.${note ? ` Note: ${note}` : ""}`,
    ],
    customer_purchase_order_declined: [
      `Purchase order declined — ${orderNumber}`,
      "Purchase Order Declined",
      `The submitted purchase order was declined.${note ? ` Note: ${note}` : ""}`,
    ],
    customer_invoice_issued: [
      `Invoice issued — ${text(payload.invoiceNumber)}`,
      "Invoice Issued",
      `Invoice ${text(payload.invoiceNumber)} has been issued for ${money(payload.invoiceTotalCents)} and is due ${text(payload.dueDate)}.`,
    ],
    internal_invoice_issued: [
      `Invoice issued — ${text(payload.invoiceNumber)}`,
      "Invoice Issued",
      `Invoice ${text(payload.invoiceNumber)} was issued to ${agencyName || "the agency"}.`,
    ],
    customer_invoice_partial_payment: [
      `Payment received — ${text(payload.invoiceNumber)}`,
      "Partial Payment Received",
      `A payment of ${money(payload.paymentAmountCents)} was recorded. Remaining balance: ${money(payload.balanceCents)}.`,
    ],
    customer_invoice_paid: [
      `Invoice paid — ${text(payload.invoiceNumber)}`,
      "Invoice Paid",
      `Invoice ${text(payload.invoiceNumber)} is paid in full.`,
    ],
    customer_asset_upload_received: [
      `Asset upload received — ${orderNumber}`,
      "Asset Upload Received",
      `We received ${text(payload.filename)} for the ${text(payload.screenLabel)}. This file has not yet been submitted for final review.`,
    ],
    customer_assets_submission_received: [
      `Final assets received — ${orderNumber}`,
      "Final Asset Submission Received",
      `Submission ${text(payload.submissionNumber)} was received and is now under review.`,
    ],
    internal_assets_ready_for_review: [
      `Assets ready for review — ${orderNumber}`,
      "Assets Ready for Review",
      `${agencyName || "An agency client"} submitted final advertising assets for review.`,
    ],
    customer_assets_revision_requested: [
      `Asset revisions requested — ${orderNumber}`,
      "Asset Revisions Requested",
      `The processing team requested revisions to one or more advertising assets.${note ? ` Note: ${note}` : ""}`,
    ],
    customer_assets_approved: [
      `Advertising assets approved — ${orderNumber}`,
      "Advertising Assets Approved",
      `Your final advertising assets were approved and entered the release queue.`,
    ],
    internal_assets_release_ready: [
      `Approved assets ready for release — ${orderNumber}`,
      "Assets Ready for Release",
      `Approved assets are ready for manual release while the LED provider API remains pending.`,
    ],
    customer_assets_released: [
      `Advertising assets released — ${orderNumber}`,
      "Assets Released",
      `Your approved assets were released to the screen workflow.`,
    ],
    customer_campaign_live: [
      `Campaign is live — ${orderNumber}`,
      "Your Campaign Is Live",
      `Your La Grandiosa campaign has been marked live.`,
    ],
  };

  const chosen = templates[templateKey];
  if (chosen) [subject, heading, body] = chosen;

  const action = portalUrl ? `\n\nOpen the secure portal: ${portalUrl}` : "";
  const plain = `${heading}\n\n${body}${action}\n\nQuestions: ventas@lagrandiosapr.com`;
  const safeHeading = escapeHtml(heading);
  const safeBody = escapeHtml(body);
  const safeUrl = portalUrl ? escapeHtml(portalUrl) : "";
  const html = `<!doctype html><html><body style="margin:0;background:#030a3f;font-family:Arial,sans-serif;color:#ffffff"><div style="max-width:640px;margin:0 auto;padding:40px 24px"><div style="border-top:6px solid #ff9d00;background:#0d185e;padding:34px"><p style="margin:0 0 12px;color:#ff9d00;font-size:12px;font-weight:800;letter-spacing:.14em">LA GRANDIOSA</p><h1 style="margin:0 0 20px;font-size:32px;line-height:1.05">${safeHeading}</h1><p style="margin:0;color:#e8ecff;font-size:17px;line-height:1.6">${safeBody}</p>${safeUrl ? `<p style="margin:28px 0 0"><a href="${safeUrl}" style="display:inline-block;padding:15px 20px;background:#ff9d00;color:#030a3f;text-decoration:none;font-weight:800">OPEN SECURE PORTAL</a></p>` : ""}<p style="margin:30px 0 0;color:#b7c0ff;font-size:13px">Reply to ventas@lagrandiosapr.com for assistance.</p></div></div></body></html>`;
  const sms = `${heading}: ${body}${portalUrl ? ` ${portalUrl}` : ""}`.slice(0, 1500);
  return { subject, text: plain, html, sms };
}
