import { NextRequest, NextResponse } from "next/server";

import { AgencyAccessError } from "@/lib/auth/access";
import { buildInvoicePdf } from "@/lib/server/invoice-pdf";
import { requireInvoiceViewerForApi } from "@/lib/server/procurement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> },
) {
  try {
    const { invoiceId } = await context.params;

    await requireInvoiceViewerForApi(invoiceId);
    const admin = createSupabaseAdminClient();
    const { data: invoice } = await admin
      .from("invoices")
      .select("invoice_number")
      .eq("id", invoiceId)
      .single();

    if (!invoice) {
      throw new Error("Invoice could not be found.");
    }

    const bytes = await buildInvoicePdf(invoiceId);

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
