function money(value: unknown): string {
  const cents = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>\"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

function resolveBrandAssetUrl(portalUrl: string, assetPath: string): string {
  if (portalUrl) {
    try {
      return new URL(assetPath, portalUrl).toString();
    } catch {
      // Fallback handled below.
    }
  }

  const configuredBase =
    process.env.APP_BASE_URL?.trim() ||
    "https://www.lagrandiosapr.com";
  return `${configuredBase.replace(/\/$/, "")}${assetPath}`;
}

export interface RenderedNotification {
  subject: string;
  text: string;
  html: string;
  sms: string;
}

interface TemplateContent {
  subject: string;
  heading: string;
  body: string;
  actionLabel?: string;
}

export function renderNotification(
  templateKey: string,
  payload: Record<string, unknown>,
): RenderedNotification {
  const orderNumber =
    text(payload.orderNumber) || "your La Grandiosa order";
  const agencyName = text(payload.agencyName);
  const note = text(payload.reviewerNote || payload.reviewNote || payload.note);
  const portalUrl = text(
    payload.portalUrl ||
      payload.assetPortalUrl ||
      payload.invoiceUrl ||
      payload.actionUrl,
  );
  const dueDate = text(payload.dueDate || payload.assetDueDate);
  const days = text(payload.daysUntilDue || payload.daysOverdue);

  const templates: Record<string, TemplateContent> = {
    customer_agency_order_received: {
      subject: `La Grandiosa order ${orderNumber} received`,
      heading: "Agency Order Received",
      body: `Your order has been saved for ${agencyName || "your agency"}. The next step is purchase-order and credit processing.`,
      actionLabel: "OPEN SECURE PORTAL",
    },
    internal_new_agency_order_received: {
      subject: `New La Grandiosa agency order ${orderNumber}`,
      heading: "New Agency Order",
      body: `A new order has been submitted by ${agencyName || "an agency client"}.`,
      actionLabel: "OPEN INTERNAL PORTAL",
    },
    internal_credit_exception_review_required: {
      subject: `Credit review required — ${orderNumber}`,
      heading: "Credit Review Required",
      body: "The order exceeds currently available credit and requires finance review.",
      actionLabel: "REVIEW CREDIT",
    },
    customer_purchase_order_received: {
      subject: `Purchase order received — ${orderNumber}`,
      heading: "Purchase Order Received",
      body: "Your purchase-order PDF was received and is waiting for processing-team review.",
      actionLabel: "VIEW ORDER",
    },
    internal_purchase_order_review_required: {
      subject: `PO review required — ${orderNumber}`,
      heading: "Purchase Order Review Required",
      body: `A purchase-order document was submitted by ${agencyName || "an agency client"}.`,
      actionLabel: "REVIEW PURCHASE ORDER",
    },
    customer_purchase_order_approved: {
      subject: `Purchase order approved — ${orderNumber}`,
      heading: "Purchase Order Approved",
      body: "Your purchase order was approved. The invoice will be issued through the secure portal.",
      actionLabel: "OPEN SECURE PORTAL",
    },
    customer_purchase_order_revision_requested: {
      subject: `Purchase-order revision requested — ${orderNumber}`,
      heading: "Purchase-Order Revision Requested",
      body: `The processing team requested a purchase-order revision.${note ? ` Note: ${note}` : ""}`,
      actionLabel: "UPLOAD REVISED PO",
    },
    customer_purchase_order_declined: {
      subject: `Purchase order declined — ${orderNumber}`,
      heading: "Purchase Order Declined",
      body: `The submitted purchase order was declined.${note ? ` Note: ${note}` : ""}`,
      actionLabel: "VIEW ORDER",
    },
    customer_invoice_issued: {
      subject: `Invoice issued — ${text(payload.invoiceNumber)}`,
      heading: "Invoice and Contract Confirmation",
      body: `Invoice ${text(payload.invoiceNumber)} has been issued for ${money(payload.invoiceTotalCents)} and is due ${dueDate}. Your secure portal contains the invoice, contract details, remittance instructions, and asset-upload access.`,
      actionLabel: "OPEN INVOICE AND ASSET PORTAL",
    },
    internal_invoice_issued: {
      subject: `Invoice issued — ${text(payload.invoiceNumber)}`,
      heading: "Invoice Issued",
      body: `Invoice ${text(payload.invoiceNumber)} was issued to ${agencyName || "the agency"}.`,
      actionLabel: "OPEN INVOICE ADMINISTRATION",
    },
    customer_invoice_partial_payment: {
      subject: `Payment received — ${text(payload.invoiceNumber)}`,
      heading: "Partial Payment Received",
      body: `A payment of ${money(payload.paymentAmountCents)} was recorded. Remaining balance: ${money(payload.balanceCents)}.`,
      actionLabel: "VIEW INVOICE",
    },
    customer_invoice_paid: {
      subject: `Invoice paid — ${text(payload.invoiceNumber)}`,
      heading: "Invoice Paid",
      body: `Invoice ${text(payload.invoiceNumber)} is paid in full. Thank you.`,
      actionLabel: "VIEW INVOICE",
    },
    customer_invoice_due_reminder: {
      subject: `Invoice due reminder — ${text(payload.invoiceNumber)}`,
      heading: "Invoice Due Reminder",
      body: `Invoice ${text(payload.invoiceNumber)} has a balance of ${money(payload.balanceCents)} and is due ${dueDate}${days ? ` (${days} day${days === "1" ? "" : "s"} remaining)` : ""}.`,
      actionLabel: "VIEW INVOICE",
    },
    customer_invoice_overdue: {
      subject: `Invoice overdue — ${text(payload.invoiceNumber)}`,
      heading: "Invoice Overdue",
      body: `Invoice ${text(payload.invoiceNumber)} has an outstanding balance of ${money(payload.balanceCents)} and is ${days || ""} day${days === "1" ? "" : "s"} overdue.`,
      actionLabel: "VIEW INVOICE",
    },
    internal_invoice_overdue: {
      subject: `Invoice overdue — ${text(payload.invoiceNumber)}`,
      heading: "Invoice Follow-Up Required",
      body: `${agencyName || "An agency"} has an overdue invoice balance of ${money(payload.balanceCents)}.${days ? ` It is ${days} days overdue.` : ""}`,
      actionLabel: "OPEN INVOICE ADMINISTRATION",
    },
    customer_asset_deadline_set: {
      subject: `Asset deadline confirmed — ${orderNumber}`,
      heading: "Advertising Asset Deadline",
      body: `Final advertising assets for ${orderNumber} are due ${dueDate}.${note ? ` Note: ${note}` : ""}`,
      actionLabel: "OPEN ASSET REPOSITORY",
    },
    customer_asset_due_reminder: {
      subject: `Asset reminder — ${orderNumber}`,
      heading: "Advertising Assets Due Soon",
      body: `Final advertising assets are due ${dueDate}${days ? ` (${days} day${days === "1" ? "" : "s"} remaining)` : ""}.`,
      actionLabel: "UPLOAD ASSETS",
    },
    customer_assets_overdue: {
      subject: `Advertising assets overdue — ${orderNumber}`,
      heading: "Advertising Assets Overdue",
      body: `The final advertising assets for ${orderNumber} are ${days || ""} day${days === "1" ? "" : "s"} overdue. Please upload or contact the processing team immediately.`,
      actionLabel: "UPLOAD ASSETS",
    },
    internal_asset_deadline_missing: {
      subject: `Asset deadline required — ${orderNumber}`,
      heading: "Asset Deadline Missing",
      body: `${orderNumber} is approaching its campaign start date, but no asset deadline has been assigned.`,
      actionLabel: "SET ASSET DEADLINE",
    },
    internal_assets_overdue: {
      subject: `Assets overdue — ${orderNumber}`,
      heading: "Asset Follow-Up Required",
      body: `${agencyName || "An agency"} has overdue assets for ${orderNumber}.${days ? ` The deadline passed ${days} day${days === "1" ? "" : "s"} ago.` : ""}`,
      actionLabel: "OPEN DEADLINE ADMINISTRATION",
    },
    customer_asset_upload_received: {
      subject: `Asset upload received — ${orderNumber}`,
      heading: "Asset Upload Received",
      body: `We received ${text(payload.filename)} for the ${text(payload.screenLabel)}. This file has not yet been submitted for final review.`,
      actionLabel: "OPEN ASSET REPOSITORY",
    },
    customer_assets_submission_received: {
      subject: `Final assets received — ${orderNumber}`,
      heading: "Final Asset Receipt Confirmation",
      body: `Submission ${text(payload.submissionNumber)} was received and is now under review. This email confirms receipt of the final submitted files.`,
      actionLabel: "VIEW SUBMISSION",
    },
    internal_assets_ready_for_review: {
      subject: `Assets ready for review — ${orderNumber}`,
      heading: "Assets Ready for Review",
      body: `${agencyName || "An agency client"} submitted final advertising assets for review.`,
      actionLabel: "REVIEW ASSETS",
    },
    customer_assets_revision_requested: {
      subject: `Asset revisions requested — ${orderNumber}`,
      heading: "Asset Revisions Requested",
      body: `The processing team requested revisions to one or more advertising assets.${note ? ` Note: ${note}` : ""}`,
      actionLabel: "UPLOAD REVISIONS",
    },
    customer_assets_approved: {
      subject: `Advertising assets approved — ${orderNumber}`,
      heading: "Advertising Assets Approved",
      body: "Your final advertising assets were approved and entered the release queue.",
      actionLabel: "VIEW ORDER",
    },
    internal_assets_release_ready: {
      subject: `Approved assets ready for release — ${orderNumber}`,
      heading: "Assets Ready for Release",
      body: "Approved assets are ready for manual release while the LED provider API remains pending.",
      actionLabel: "OPEN RELEASE QUEUE",
    },
    customer_assets_released: {
      subject: `Advertising assets released — ${orderNumber}`,
      heading: "Assets Released",
      body: "Your approved assets were released to the screen workflow.",
      actionLabel: "VIEW ORDER",
    },
    customer_campaign_starting_tomorrow: {
      subject: `Campaign starts tomorrow — ${orderNumber}`,
      heading: "Your Campaign Starts Tomorrow",
      body: `The La Grandiosa campaign for ${orderNumber} is scheduled to begin tomorrow.`,
      actionLabel: "VIEW CAMPAIGN",
    },
    internal_campaign_starting_unreleased: {
      subject: `Campaign starts tomorrow but is not released — ${orderNumber}`,
      heading: "Release Action Required",
      body: `${orderNumber} begins tomorrow and remains in release pending status.`,
      actionLabel: "OPEN RELEASE QUEUE",
    },
    customer_campaign_live: {
      subject: `Campaign is live — ${orderNumber}`,
      heading: "Your Campaign Is Live",
      body: "Your La Grandiosa campaign has been marked live.",
      actionLabel: "VIEW CAMPAIGN",
    },
    internal_campaign_completion_review: {
      subject: `Campaign completion review — ${orderNumber}`,
      heading: "Campaign Completion Review",
      body: `${orderNumber} has passed its final scheduled date and should be reviewed for completion.`,
      actionLabel: "OPEN RELEASE QUEUE",
    },
    internal_access_request_received: {
      subject: "New La Grandiosa access request",
      heading: "New Access Request",
      body: `${text(payload.requesterName || payload.requesterEmail || "A client")} requested access for ${text(payload.company || "a new account")}${text(payload.requesterEmail) ? ` (${text(payload.requesterEmail)})` : ""}. ${text(payload.message)}`,
      actionLabel: "REVIEW ACCESS REQUEST",
    },
    customer_access_request_received: {
      subject: "Your La Grandiosa access request is received",
      heading: "Access Request Received",
      body: `Thanks for reaching out. We will review your request and follow up with access instructions shortly. ${text(payload.portalUrl) ? `You can also sign in here: ${text(payload.portalUrl)}` : ""}`,
      actionLabel: "OPEN SECURE PORTAL",
    },
  };

  const chosen =
    templates[templateKey] ?? {
      subject: `La Grandiosa update — ${orderNumber}`,
      heading: "La Grandiosa Order Update",
      body: `There is an update for ${orderNumber}.`,
      actionLabel: "OPEN SECURE PORTAL",
    };

  const action = portalUrl
    ? `\n\nOpen the secure portal: ${portalUrl}`
    : "";
  const plain = `${chosen.heading}\n\n${chosen.body}${action}\n\nQuestions: ventas@lagrandiosapr.com`;
  const safeHeading = escapeHtml(chosen.heading);
  const safeBody = escapeHtml(chosen.body);
  const safeUrl = portalUrl ? escapeHtml(portalUrl) : "";
  const safeSignatureLogoUrl = escapeHtml(
    resolveBrandAssetUrl(portalUrl, "/la-grandiosa-logo-black.png"),
  );
  const safeActionLabel = escapeHtml(
    chosen.actionLabel ?? "OPEN SECURE PORTAL",
  );

  const html = `<!doctype html><html><body style="margin:0;background:#030a3f;font-family:Arial,Helvetica,sans-serif;color:#ffffff"><div style="max-width:680px;margin:0 auto;padding:42px 22px"><div style="border-top:7px solid #ff9d00;background:#0d185e;padding:38px"><p style="margin:0 0 14px;color:#ff9d00;font-size:12px;font-weight:800;letter-spacing:.14em">LA GRANDIOSA · THE MALL OF SAN JUAN</p><h1 style="margin:0 0 22px;font-size:34px;line-height:1.05">${safeHeading}</h1><p style="margin:0;color:#e8ecff;font-size:17px;line-height:1.65">${safeBody}</p>${safeUrl ? `<p style="margin:30px 0 0"><a href="${safeUrl}" style="display:inline-block;padding:16px 22px;background:#ff9d00;color:#030a3f;text-decoration:none;font-weight:800">${safeActionLabel}</a></p>` : ""}<p style="margin:32px 0 0;color:#b7c0ff;font-size:13px;line-height:1.5">Reply to ventas@lagrandiosapr.com for assistance.<br>Transactional notice for your La Grandiosa account.</p><div style="margin:24px 0 0;padding-top:18px;border-top:1px solid rgba(183,192,255,.35);text-align:center"><div style="display:inline-block;background:#ffffff;padding:10px 16px"><img src="${safeSignatureLogoUrl}" alt="La Grandiosa" width="220" style="display:block;width:220px;max-width:100%;height:auto;margin:0 auto"></div></div></div></div></body></html>`;

  const sms = `${chosen.heading}: ${chosen.body}${portalUrl ? ` ${portalUrl}` : ""}`.slice(
    0,
    1500,
  );

  return {
    subject: chosen.subject,
    text: plain,
    html,
    sms,
  };
}
