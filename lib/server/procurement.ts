import {
  AgencyAccessError,
  getVerifiedIdentity,
} from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const PURCHASE_ORDER_BUCKET = "purchase-orders";
export const MAX_PO_BYTES = 15 * 1024 * 1024;

export interface OrderViewer {
  userId: string;
  email: string;
  isStaff: boolean;
  agencyId: string;
}

export async function requireOrderViewerForApi(
  orderId: string,
): Promise<OrderViewer> {
  const identity = await getVerifiedIdentity();

  if (!identity) {
    throw new AgencyAccessError(
      "Authentication is required.",
      401,
      "AUTH_REQUIRED",
    );
  }

  if (identity.currentLevel !== "aal2") {
    throw new AgencyAccessError(
      "Authenticator verification is required.",
      403,
      "MFA_REQUIRED",
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id,agency_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order?.agency_id) {
    throw new AgencyAccessError(
      "Order not found.",
      404,
      "ORDER_NOT_FOUND",
    );
  }

  const [{ data: staff }, { data: membership }] = await Promise.all([
    admin
      .from("staff_members")
      .select("role,active")
      .eq("user_id", identity.userId)
      .maybeSingle(),
    admin
      .from("agency_members")
      .select("agency_id,status")
      .eq("user_id", identity.userId)
      .eq("agency_id", order.agency_id)
      .maybeSingle(),
  ]);

  const isStaff = staff?.active === true;
  const isAgencyMember =
    membership?.status === "active" &&
    membership?.agency_id === order.agency_id;

  if (!isStaff && !isAgencyMember) {
    throw new AgencyAccessError(
      "The order is not available to this account.",
      403,
      "ORDER_ACCESS_DENIED",
    );
  }

  return {
    userId: identity.userId,
    email: identity.email,
    isStaff,
    agencyId: String(order.agency_id),
  };
}

export async function requireInvoiceViewerForApi(
  invoiceId: string,
): Promise<OrderViewer & { orderId: string }> {
  const admin = createSupabaseAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("id,order_id")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice?.order_id) {
    throw new AgencyAccessError(
      "Invoice not found.",
      404,
      "INVOICE_NOT_FOUND",
    );
  }

  const viewer = await requireOrderViewerForApi(
    String(invoice.order_id),
  );

  return {
    ...viewer,
    orderId: String(invoice.order_id),
  };
}

export function cleanPdfFilename(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);

  return cleaned.toLowerCase().endsWith(".pdf")
    ? cleaned
    : `${cleaned || "purchase-order"}.pdf`;
}
