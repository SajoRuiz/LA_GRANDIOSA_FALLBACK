import Link from "next/link";
import { requireAgencyPurchaseAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import styles from "./orders.module.css";

const ASSET_STATUSES = new Set([
  "po_submitted",
  "po_revision_requested",
  "awaiting_assets",
  "assets_received",
  "under_review",
  "revision_requested",
  "approved",
  "release_pending",
  "released",
  "live",
]);

interface PurchaseOrderSummary {
  id: string;
  po_number: string;
  status: string;
}

interface InvoiceSummary {
  id: string;
  invoice_number: string;
  status: string;
  balance_cents: number;
}

interface AgencyOrderRow {
  id: string;
  order_number: string;
  status: string;
  credit_status: string;
  net_contract_total_cents: number | string;
  created_at: string;
  purchase_orders: PurchaseOrderSummary[] | PurchaseOrderSummary | null;
  invoices: InvoiceSummary[] | InvoiceSummary | null;
}

function money(value: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) / 100);
}

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "").replaceAll("_", " ");
}

export default async function AgencyOrdersPage() {
  const access = await requireAgencyPurchaseAccess("/portal/orders");
  const admin = createSupabaseAdminClient();

  const { data } = await admin
    .from("orders")
    .select(
      "id,order_number,status,credit_status,net_contract_total_cents,created_at,purchase_orders(id,po_number,status),invoices(id,invoice_number,status,balance_cents)",
    )
    .eq("agency_id", access.agency.id)
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as AgencyOrderRow[];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/portal" aria-label="Return to agency portal">
          <img
            className={styles.logo}
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
        </Link>
        <Link href="/portal">Agency portal</Link>
      </header>

      <section className={styles.hero}>
        <p>AGENCY ORDERS</p>
        <h1>Purchase orders, assets, and campaigns.</h1>
      </section>

      <section className={styles.list}>
        {orders.length === 0 ? (
          <p>No agency orders have been created.</p>
        ) : (
          orders.map((order) => {
            const purchaseOrder = Array.isArray(order.purchase_orders)
              ? order.purchase_orders[0]
              : order.purchase_orders;
            const invoice = Array.isArray(order.invoices)
              ? order.invoices[0]
              : order.invoices;

            const canManagePurchaseOrder = [
              "client_information_received",
              "po_submitted",
              "po_revision_requested",
            ].includes(order.status);

            return (
              <article className={styles.card} key={order.id}>
                <div>
                  <p>{order.order_number}</p>
                  <h2>{money(order.net_contract_total_cents)}</h2>
                </div>

                <dl>
                  <div>
                    <dt>Order</dt>
                    <dd>{normalizeStatus(order.status)}</dd>
                  </div>
                  <div>
                    <dt>Credit</dt>
                    <dd>{normalizeStatus(order.credit_status)}</dd>
                  </div>
                  <div>
                    <dt>PO</dt>
                    <dd>
                      {purchaseOrder?.status
                        ? normalizeStatus(purchaseOrder.status)
                        : "not submitted"}
                    </dd>
                  </div>
                  <div>
                    <dt>Invoice</dt>
                    <dd>{invoice?.invoice_number ?? "not issued"}</dd>
                  </div>
                </dl>

                <div className={styles.actions}>
                  {canManagePurchaseOrder ? (
                    <Link href={`/portal/orders/${order.id}/purchase-order`}>
                      {purchaseOrder ? "View / revise PO" : "Upload purchase order"}
                    </Link>
                  ) : null}

                  {purchaseOrder?.id && ASSET_STATUSES.has(order.status) ? (
                    <Link href={`/portal/orders/${order.id}/assets`}>
                      Upload assets for review
                    </Link>
                  ) : null}

                  {invoice?.id ? (
                    <Link href={`/portal/invoices/${invoice.id}`}>
                      View invoice
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
