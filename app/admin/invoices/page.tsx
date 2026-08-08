import Link from "next/link";

import { requireStaffAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import InvoiceAdminClient from "./InvoiceAdminClient";
import styles from "./invoices.module.css";

export default async function InvoiceAdminPage() {
  await requireStaffAccess("/admin/invoices", [
    "finance",
    "system_admin",
  ]);
  const admin = createSupabaseAdminClient();
  const [ordersResult, invoicesResult, accountsResult] =
    await Promise.all([
      admin
        .from("orders")
        .select(
          "id,order_number,net_contract_total_cents,agency_accounts(display_name)",
        )
        .eq("status", "po_approved")
        .order("created_at", { ascending: true }),
      admin
        .from("invoices")
        .select(
          "id,invoice_number,status,total_cents,paid_cents,balance_cents,due_date,agency_accounts(display_name)",
        )
        .order("invoice_date", { ascending: false }),
      admin
        .from("remittance_accounts")
        .select("id,display_name,bank_name,account_last4")
        .eq("active", true),
    ]);

  const approvedOrders = (ordersResult.data ?? []).map((order) => {
    const agency = Array.isArray(order.agency_accounts)
      ? order.agency_accounts[0]
      : order.agency_accounts;

    return {
      id: order.id,
      orderNumber: order.order_number,
      agencyName: agency?.display_name ?? "",
      totalCents: Number(order.net_contract_total_cents),
    };
  });

  const invoices = (invoicesResult.data ?? []).map((invoice) => {
    const agency = Array.isArray(invoice.agency_accounts)
      ? invoice.agency_accounts[0]
      : invoice.agency_accounts;

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      agencyName: agency?.display_name ?? "",
      status: invoice.status,
      totalCents: Number(invoice.total_cents),
      paidCents: Number(invoice.paid_cents),
      balanceCents: Number(invoice.balance_cents),
      dueDate: invoice.due_date,
    };
  });

  const remittanceAccounts = (accountsResult.data ?? []).map(
    (account) => ({
      id: account.id,
      displayName: account.display_name,
      bankName: account.bank_name,
      last4: account.account_last4,
    }),
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
          <Link href="/admin/purchase-orders">PO review</Link>
          <Link href="/admin/credit">Credit</Link>
          <Link href="/admin/remittance">Remittance</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <p>FINANCE ADMINISTRATION</p>
        <h1>Invoices and payments.</h1>
      </section>

      <InvoiceAdminClient
        approvedOrders={approvedOrders}
        invoices={invoices}
        remittanceAccounts={remittanceAccounts}
      />
    </main>
  );
}
