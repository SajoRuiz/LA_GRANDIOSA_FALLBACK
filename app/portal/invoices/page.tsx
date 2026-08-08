import Link from "next/link";

import { requireAgencyPurchaseAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import styles from "../orders/orders.module.css";

const money = (value: number | string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) / 100);

export default async function AgencyInvoicesPage() {
  const access = await requireAgencyPurchaseAccess(
    "/portal/invoices",
  );
  const admin = createSupabaseAdminClient();
  const { data: invoices } = await admin
    .from("invoices")
    .select(
      "id,invoice_number,status,invoice_date,due_date,total_cents,paid_cents,balance_cents,orders(order_number)",
    )
    .eq("agency_id", access.agency.id)
    .order("invoice_date", { ascending: false });

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
        <Link href="/portal">Agency portal</Link>
      </header>

      <section className={styles.hero}>
        <p>AGENCY INVOICES</p>
        <h1>Billing and remittance.</h1>
      </section>

      <section className={styles.list}>
        {(invoices ?? []).length === 0 ? (
          <p>No invoices have been issued.</p>
        ) : (
          (invoices ?? []).map((invoice) => {
            const order = Array.isArray(invoice.orders)
              ? invoice.orders[0]
              : invoice.orders;

            return (
              <article className={styles.card} key={invoice.id}>
                <div>
                  <p>{invoice.invoice_number}</p>
                  <h2>{money(invoice.balance_cents)}</h2>
                </div>

                <dl>
                  <div>
                    <dt>Order</dt>
                    <dd>{order?.order_number ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      {String(invoice.status).replaceAll("_", " ")}
                    </dd>
                  </div>
                  <div>
                    <dt>Invoice date</dt>
                    <dd>{invoice.invoice_date}</dd>
                  </div>
                  <div>
                    <dt>Due date</dt>
                    <dd>{invoice.due_date}</dd>
                  </div>
                </dl>

                <div className={styles.actions}>
                  <Link href={`/portal/invoices/${invoice.id}`}>
                    View invoice
                  </Link>
                  <a href={`/api/invoices/${invoice.id}/pdf`}>
                    Download PDF
                  </a>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
