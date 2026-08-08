import { NextResponse } from "next/server";

import { AgencyAccessError } from "@/lib/auth/access";
import { buildInvoicePdf } from "@/lib/server/invoice-pdf";
import { requireInvoiceViewerForApi } from "@/lib/server/procurement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: { invoiceId: string } },
) {
  try {
    await requireInvoiceViewerForApi(context.params.invoiceId);
    const admin = createSupabaseAdminClient();
    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .select("invoice_number")
      .eq("id", context.params.invoiceId)
      .single();
    if (invoiceError || !invoice) {
      throw new Error(invoiceError?.message ?? "Invoice was not found.");
    }

    const bytes = await buildInvoicePdf(context.params.invoiceId);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          `attachment; filename="${invoice.invoice_number}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AgencyAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invoice PDF could not be generated.",
      },
      { status: 400 },
    );
  }
}
