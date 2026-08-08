import Link from "next/link";

import { requireStaffAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import PurchaseOrderAdminClient, {
  type PurchaseOrderReviewItem,
} from "./PurchaseOrderAdminClient";
import styles from "./purchase-orders.module.css";

export default async function PurchaseOrderAdminPage() {
  await requireStaffAccess("/admin/purchase-orders", [
    "finance",
    "system_admin",
  ]);
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("purchase_orders")
    .select(
      "id,po_number,status,submitted_at,reviewer_note,orders(id,order_number,net_contract_total_cents,credit_status),agency_accounts(display_name,account_number),purchase_order_documents(id,version_number,original_filename,created_at)",
    )
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true });

  const purchaseOrders: PurchaseOrderReviewItem[] = (data ?? []).map(
    (row) => {
      const order = Array.isArray(row.orders)
        ? row.orders[0]
        : row.orders;
      const agency = Array.isArray(row.agency_accounts)
        ? row.agency_accounts[0]
        : row.agency_accounts;
      const documents = Array.isArray(
        row.purchase_order_documents,
      )
        ? row.purchase_order_documents
        : [];
      const document = documents
        .slice()
        .sort(
          (a, b) => b.version_number - a.version_number,
        )[0];

      return {
        id: row.id,
        poNumber: row.po_number,
        status: row.status,
        submittedAt: row.submitted_at,
        reviewerNote: row.reviewer_note ?? "",
        orderId: order?.id ?? "",
        orderNumber: order?.order_number ?? "",
        totalCents: Number(order?.net_contract_total_cents ?? 0),
        creditStatus: order?.credit_status ?? "",
        agencyName: agency?.display_name ?? "",
        accountNumber: agency?.account_number ?? "",
        documentId: document?.id ?? "",
        documentVersion: document?.version_number ?? 0,
        filename: document?.original_filename ?? "",
      };
    },
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin/agencies">
          <img
            className={styles.logo}
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
        </Link>
        <nav>
          <Link href="/admin/credit">Credit</Link>
          <Link href="/admin/invoices">Invoices</Link>
          <Link href="/admin/remittance">Remittance</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <p>PROCESSING TEAM</p>
        <h1>Purchase-order review.</h1>
      </section>

      <PurchaseOrderAdminClient
        purchaseOrders={purchaseOrders}
      />
    </main>
  );
}
