import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAgencyPurchaseAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import styles from "./invoice.module.css";

const money = (value: number | string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) / 100);

export default async function InvoiceDetailPage({
  params,
}: {
  params: { invoiceId: string };
}) {
  const access = await requireAgencyPurchaseAccess(
    `/portal/invoices/${params.invoiceId}`,
  );
  const admin = createSupabaseAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select(
      "id,invoice_number,status,invoice_date,due_date,pre_discount_total_cents,published_total_cents,campaign_discount_cents,agency_discount_cents,subtotal_cents,tax_cents,total_cents,paid_cents,balance_cents,payment_terms_days,remittance_account_id,purchase_orders(po_number),invoice_items(id,sort_order,description,service_period,line_total_cents)",
    )
    .eq("id", params.invoiceId)
    .eq("agency_id", access.agency.id)
    .maybeSingle();

  if (!invoice) {
    notFound();
  }

  const { data: secureRemit } = await admin.rpc(
    "get_remittance_account_secure",
    {
      p_remittance_account_id: invoice.remittance_account_id,
    },
  );
  const remit = Array.isArray(secureRemit)
    ? secureRemit[0]
    : secureRemit;
  const po = Array.isArray(invoice.purchase_orders)
    ? invoice.purchase_orders[0]
    : invoice.purchase_orders;
  const items = Array.isArray(invoice.invoice_items)
    ? invoice.invoice_items
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
    : [];

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
        <Link href="/portal/invoices">All invoices</Link>
      </header>

      <section className={styles.invoice}>
        <div className={styles.heading}>
          <div>
            <p>INVOICE</p>
            <h1>{invoice.invoice_number}</h1>
          </div>
          <a href={`/api/invoices/${invoice.id}/pdf`}>
            Download PDF
          </a>
        </div>

        <dl className={styles.meta}>
          <div>
            <dt>Status</dt>
            <dd>{String(invoice.status).replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Invoice date</dt>
            <dd>{invoice.invoice_date}</dd>
          </div>
          <div>
            <dt>Due date</dt>
            <dd>{invoice.due_date}</dd>
          </div>
          <div>
            <dt>PO number</dt>
            <dd>{po?.po_number ?? "—"}</dd>
          </div>
        </dl>

        <section className={styles.items}>
          <h2>Campaign items</h2>
          {items.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.description}</strong>
                <span>{item.service_period}</span>
              </div>
              <b>{money(item.line_total_cents)}</b>
            </article>
          ))}
        </section>

        <div className={styles.bottom}>
          <section className={styles.remittance}>
            <h2>Secure remittance instructions</h2>
            <dl>
              <div>
                <dt>Bank</dt>
                <dd>{remit?.bank_name}</dd>
              </div>
              <div>
                <dt>Beneficiary</dt>
                <dd>{remit?.beneficiary_name}</dd>
              </div>
              <div>
                <dt>Account type</dt>
                <dd>{remit?.account_type}</dd>
              </div>
              <div>
                <dt>Routing number</dt>
                <dd>{remit?.routing_number}</dd>
              </div>
              <div>
                <dt>Account number</dt>
                <dd>{remit?.account_number}</dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd>{invoice.invoice_number}</dd>
              </div>
            </dl>
            {remit?.instructions ? (
              <p>{remit.instructions}</p>
            ) : null}
            <small>
              La Grandiosa will never change banking instructions
              solely by email. Verify any change with
              processing@lagrandiosapr.com.
            </small>
          </section>

          <section className={styles.totals}>
            <div>
              <span>Campaign total before discounts</span>
              <strong>
                {money(invoice.pre_discount_total_cents)}
              </strong>
            </div>
            <div>
              <span>Campaign discount</span>
              <strong>
                −{money(invoice.campaign_discount_cents)}
              </strong>
            </div>
            <div>
              <span>Agency discount</span>
              <strong>−{money(invoice.agency_discount_cents)}</strong>
            </div>
            <div>
              <span>Subtotal</span>
              <strong>{money(invoice.subtotal_cents)}</strong>
            </div>
            <div>
              <span>Tax</span>
              <strong>{money(invoice.tax_cents)}</strong>
            </div>
            <div>
              <span>Invoice total</span>
              <strong>{money(invoice.total_cents)}</strong>
            </div>
            <div>
              <span>Paid</span>
              <strong>−{money(invoice.paid_cents)}</strong>
            </div>
            <div className={styles.balance}>
              <span>Balance due</span>
              <strong>{money(invoice.balance_cents)}</strong>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
