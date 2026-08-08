import Link from "next/link";
import { requireStaffAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAgencyCreditSummary } from "@/lib/server/agency-credit";
import CreditAdminClient from "./CreditAdminClient";
import styles from "./credit.module.css";

export default async function CreditAdministrationPage() {
  const staff = await requireStaffAccess("/admin/credit", [
    "finance",
    "system_admin",
  ]);
  const admin = createSupabaseAdminClient();
  const { data: agencies } = await admin
    .from("agency_accounts")
    .select("id,account_number,display_name,status")
    .order("display_name");

  const summaries = await Promise.all(
    (agencies ?? []).map(async (agency) => ({
      agency: {
        id: String(agency.id),
        accountNumber: String(agency.account_number),
        displayName: String(agency.display_name),
        status: String(agency.status),
      },
      credit: await getAgencyCreditSummary(String(agency.id)),
    })),
  );

  const { data: reviews } = await admin
    .from("agency_credit_reviews")
    .select(
      "id,agency_id,order_id,requested_amount_cents,available_credit_cents,shortfall_cents,status,created_at,agency_accounts(display_name,account_number),orders(order_number,net_contract_total_cents)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin/agencies" aria-label="Agency administration">
          <img
            className={styles.logo}
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
        </Link>
        <div className={styles.headerActions}>
          <Link href="/admin/agencies">Agency accounts</Link>
          <Link href="/admin/purchase-orders">PO review</Link>
          <Link href="/admin/invoices">Invoices</Link>
          <Link href="/admin/remittance">Remittance</Link>
          <span>
            {staff.profile.full_name} · {staff.staff.role.replaceAll("_", " ")}
          </span>
        </div>
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>INTERNAL CREDIT ADMINISTRATION</p>
        <h1>Credit exposure and exception review.</h1>
        <p>
          Review approved limits, current exposure, active holds, pending
          exceptions, and finance adjustments before the PO and invoice stage.
        </p>
      </section>

      <CreditAdminClient
        summaries={summaries}
        reviews={(reviews ?? []) as never[]}
      />
    </main>
  );
}
