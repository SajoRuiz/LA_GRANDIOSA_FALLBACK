import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const navy = rgb(3 / 255, 10 / 255, 63 / 255);
const orange = rgb(255 / 255, 157 / 255, 0);
const gray = rgb(0.38, 0.4, 0.47);
const light = rgb(0.92, 0.93, 0.97);

function money(cents: number | string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(cents) / 100);
}

function wrap(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, size) <= width) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function drawTextLines(
  page: PDFPage,
  lines: string[],
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = navy,
  leading = size + 3,
): number {
  let cursor = y;

  for (const line of lines) {
    page.drawText(line, {
      x,
      y: cursor,
      size,
      font,
      color,
    });
    cursor -= leading;
  }

  return cursor;
}

export async function buildInvoicePdf(
  invoiceId: string,
): Promise<Uint8Array> {
  const admin = createSupabaseAdminClient();
  const { data: invoice, error } = await admin
    .from("invoices")
    .select(
      "id,invoice_number,invoice_date,due_date,status,currency,pre_discount_total_cents,published_total_cents,campaign_discount_cents,agency_discount_cents,subtotal_cents,tax_cents,total_cents,paid_cents,balance_cents,payment_terms_days,client_snapshot,agency_snapshot,remittance_account_id,purchase_orders(po_number),invoice_items(sort_order,description,service_period,line_total_cents)",
    )
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    throw new Error(error?.message ?? "Invoice not found.");
  }

  const { data: remittance, error: remittanceError } =
    await admin.rpc("get_remittance_account_secure", {
      p_remittance_account_id: invoice.remittance_account_id,
    });

  if (remittanceError) {
    throw new Error(remittanceError.message);
  }

  const remit = Array.isArray(remittance)
    ? remittance[0]
    : remittance;
  const agency = (invoice.agency_snapshot ?? {}) as Record<
    string,
    unknown
  >;
  const client = (invoice.client_snapshot ?? {}) as Record<
    string,
    unknown
  >;
  const poRelation = Array.isArray(invoice.purchase_orders)
    ? invoice.purchase_orders[0]
    : invoice.purchase_orders;
  const items = Array.isArray(invoice.invoice_items)
    ? [...invoice.invoice_items].sort(
        (a, b) => Number(a.sort_order) - Number(b.sort_order),
      )
    : [];

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([612, 792]);
  let y = 744;

  const newPage = () => {
    page = pdf.addPage([612, 792]);
    y = 744;
  };

  page.drawRectangle({
    x: 0,
    y: 720,
    width: 612,
    height: 72,
    color: navy,
  });
  page.drawText("LA GRANDIOSA", {
    x: 42,
    y: 752,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText("INVOICE", {
    x: 460,
    y: 752,
    size: 18,
    font: bold,
    color: orange,
  });
  y = 690;

  page.drawText(String(invoice.invoice_number), {
    x: 42,
    y,
    size: 22,
    font: bold,
    color: navy,
  });
  page.drawText(
    `Status: ${String(invoice.status)
      .replaceAll("_", " ")
      .toUpperCase()}`,
    {
      x: 365,
      y: y + 4,
      size: 9,
      font: bold,
      color: gray,
    },
  );
  y -= 32;

  const meta = [
    `Invoice date: ${invoice.invoice_date}`,
    `Due date: ${invoice.due_date}`,
    `Payment terms: Net ${invoice.payment_terms_days}`,
    `PO number: ${poRelation?.po_number ?? "—"}`,
  ];
  y = drawTextLines(page, meta, 42, y, regular, 10, navy, 15) - 12;

  page.drawRectangle({
    x: 42,
    y: y - 82,
    width: 528,
    height: 92,
    color: light,
  });
  page.drawText("BILL TO", {
    x: 54,
    y: y - 8,
    size: 10,
    font: bold,
    color: orange,
  });
  const billTo = [
    String(agency.legalName ?? agency.displayName ?? ""),
    String(client.full_name ?? ""),
    String(client.address_line_1 ?? ""),
    [client.city, client.region, client.postal_code]
      .filter(Boolean)
      .join(", "),
    String(client.email ?? ""),
  ].filter(Boolean);
  drawTextLines(page, billTo, 54, y - 25, regular, 10, navy, 14);
  y -= 110;

  page.drawText("CAMPAIGN ITEMS", {
    x: 42,
    y,
    size: 11,
    font: bold,
    color: orange,
  });
  y -= 20;

  for (const item of items) {
    if (y < 155) {
      newPage();
      page.drawText("CAMPAIGN ITEMS — CONTINUED", {
        x: 42,
        y,
        size: 11,
        font: bold,
        color: orange,
      });
      y -= 22;
    }

    const description = String(item.description);
    const service = String(item.service_period ?? "");
    const amount = money(item.line_total_cents);
    const lines = wrap(description, regular, 10, 360);

    y = drawTextLines(page, lines, 42, y, regular, 10, navy, 13);

    if (service) {
      page.drawText(service, {
        x: 42,
        y,
        size: 8,
        font: regular,
        color: gray,
      });
    }

    page.drawText(amount, {
      x: 475,
      y: y + 13,
      size: 10,
      font: bold,
      color: navy,
    });
    y -= 22;
    page.drawLine({
      start: { x: 42, y },
      end: { x: 570, y },
      thickness: 0.5,
      color: light,
    });
    y -= 14;
  }

  if (y < 250) {
    newPage();
  }

  const totalsX = 350;
  const totalRows: Array<[string, string]> = [
    ["Campaign total before discounts", money(invoice.pre_discount_total_cents)],
    ["Campaign discount", `-${money(invoice.campaign_discount_cents)}`],
    ["Agency discount", `-${money(invoice.agency_discount_cents)}`],
    ["Subtotal", money(invoice.subtotal_cents)],
    ["Tax", money(invoice.tax_cents)],
    ["Invoice total", money(invoice.total_cents)],
    ["Paid", `-${money(invoice.paid_cents)}`],
    ["Balance due", money(invoice.balance_cents)],
  ];

  for (const [label, value] of totalRows) {
    const isFinal = label === "Balance due";
    page.drawText(label, {
      x: totalsX,
      y,
      size: isFinal ? 11 : 9,
      font: isFinal ? bold : regular,
      color: isFinal ? orange : gray,
    });
    page.drawText(value, {
      x: 486,
      y,
      size: isFinal ? 11 : 9,
      font: bold,
      color: isFinal ? orange : navy,
    });
    y -= isFinal ? 25 : 17;
  }

  y -= 8;
  page.drawText("REMITTANCE INSTRUCTIONS", {
    x: 42,
    y,
    size: 11,
    font: bold,
    color: orange,
  });
  y -= 18;

  const remittanceLines = [
    `Bank: ${remit?.bank_name ?? ""}`,
    `Beneficiary: ${remit?.beneficiary_name ?? ""}`,
    `Account type: ${remit?.account_type ?? ""}`,
    `Routing number: ${remit?.routing_number ?? ""}`,
    `Account number: ${remit?.account_number ?? ""}`,
    `Remittance email: ${
      remit?.remittance_email ?? "processing@lagrandiosapr.com"
    }`,
    `Reference: ${invoice.invoice_number}`,
    remit?.instructions ? String(remit.instructions) : "",
  ].filter(Boolean);

  drawTextLines(
    page,
    remittanceLines,
    42,
    y,
    regular,
    9,
    navy,
    13,
  );

  const securityNotice =
    "Security notice: La Grandiosa will never change banking " +
    "instructions solely by email. Verify any change directly with " +
    "processing@lagrandiosapr.com.";

  drawTextLines(
    page,
    wrap(securityNotice, regular, 7.5, 528),
    42,
    42,
    regular,
    7.5,
    gray,
    10,
  );

  return pdf.save();
}
