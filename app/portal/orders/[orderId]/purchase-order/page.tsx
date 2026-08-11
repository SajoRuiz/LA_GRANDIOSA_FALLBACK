import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAgencyPurchaseAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import PurchaseOrderClient from "./PurchaseOrderClient";
import styles from "./purchase-order.module.css";

export default async function PurchaseOrderPage({
  params,
}: {
  params: { orderId: string };
}) {
  const access = await requireAgencyPurchaseAccess(
    `/portal/orders/${params.orderId}/purchase-order`,
  );
  const admin = createSupabaseAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id,order_number,status,credit_status,net_contract_total_cents,client_snapshot,purchase_orders(id,po_number,status,reviewer_note,purchase_order_documents(id,version_number,original_filename,created_at))",
    )
    .eq("id", params.orderId)
    .eq("agency_id", access.agency.id)
    .maybeSingle();

  if (!order) {
    notFound();
  }

  const po = Array.isArray(order.purchase_orders)
    ? order.purchase_orders[0]
    : order.purchase_orders;
  const documents = Array.isArray(po?.purchase_order_documents)
    ? po.purchase_order_documents
    : [];
  const canSubmit = [
    "client_information_received",
    "po_submitted",
    "po_revision_requested",
  ].includes(order.status);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/portal">
          <img
            className={styles.logo}
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
        </Link>
        <Link href="/portal/orders">Agency orders</Link>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>PURCHASE ORDER</p>
        <h1>{order.order_number}</h1>
        <p>
          Upload the approved agency PO as a PDF. Every revision is
          retained in the secure repository.
        </p>
        <div className={styles.heroActions}>
          <Link href="/portal/orders">
            Open agency purchase-order review list
          </Link>
          <Link href={`/portal/orders/${order.id}/assets`}>
            Upload assets for review
          </Link>
        </div>
      </section>

      <div className={styles.layout}>
        {canSubmit ? (
          <PurchaseOrderClient
            orderId={order.id}
            orderNumber={order.order_number}
            existingPoNumber={po?.po_number ?? ""}
          />
        ) : (
          <section className={styles.panel}>
            <h2>Purchase-order submission is closed.</h2>
            <p>
              Current order status:{" "}
              {String(order.status).replaceAll("_", " ")}
            </p>
          </section>
        )}

        <aside className={styles.panel}>
          <h2>Current review status</h2>
          <dl className={styles.details}>
            <div>
              <dt>Order status</dt>
              <dd>{String(order.status).replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Credit status</dt>
              <dd>
                {String(order.credit_status).replaceAll("_", " ")}
              </dd>
            </div>
            <div>
              <dt>PO status</dt>
              <dd>
                {po?.status
                  ? String(po.status).replaceAll("_", " ")
                  : "Not submitted"}
              </dd>
            </div>
          </dl>

          {po?.reviewer_note ? (
            <div className={styles.notice}>
              <strong>Processing-team note</strong>
              <p>{po.reviewer_note}</p>
            </div>
          ) : null}

          <h3>Document versions</h3>
          {documents.length === 0 ? (
            <p>No purchase-order PDF has been uploaded.</p>
          ) : (
            <ul className={styles.documents}>
              {documents
                .slice()
                .sort(
                  (a, b) =>
                    b.version_number - a.version_number,
                )
                .map((document) => (
                  <li key={document.id}>
                    <a
                      href={`/api/purchase-orders/documents/${document.id}`}
                    >
                      Version {document.version_number} ·{" "}
                      {document.original_filename}
                    </a>
                  </li>
                ))}
            </ul>
          )}
        </aside>
      </div>
    </main>
  );
}
