import Link from "next/link";
import { requireStaffAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import AgencyAdminClient from "./AgencyAdminClient";
import styles from "./admin.module.css";

export default async function AgencyAdministrationPage() {
  const staff = await requireStaffAccess("/admin/agencies", [
    "finance",
    "system_admin",
  ]);
  const admin = createSupabaseAdminClient();
  const { data: agencies } = await admin
    .from("agency_accounts")
    .select(
      "id,account_number,display_name,status,discount_basis_points,approved_credit_limit_cents,payment_terms_days",
    )
    .order("created_at", { ascending: false });

  const agencyOptions = (agencies ?? []).map((agency) => ({
    id: String(agency.id),
    account_number: String(agency.account_number),
    display_name: String(agency.display_name),
  }));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="Return to La Grandiosa home">
          <img
            className={styles.logo}
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
        </Link>
        <div className={styles.headerNav}>
          <Link href="/admin/credit">Credit</Link>
          <Link href="/admin/purchase-orders">PO review</Link>
          <Link href="/admin/invoices">Invoices</Link>
          <Link href="/admin/remittance">Remittance</Link>
          <Link href="/admin/security">Security</Link>
          <Link href="/admin/launch">Launch</Link>
          <span className={styles.headerMeta}>
            {staff.profile.full_name} · {staff.staff.role.replaceAll("_", " ")}
          </span>
        </div>
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>INTERNAL ACCOUNT ADMINISTRATION</p>
        <h1>Agency access and negotiated terms.</h1>
        <p>
          Create approved agency accounts, assign negotiated discounts and
          credit limits, then send invite-only user access with a separate
          one-time activation code.
        </p>
      </section>

      <section className={styles.workspace}>
        <AgencyAdminClient
          agencies={agencyOptions}
          register={(agencies ?? []).map((agency) => ({
            id: String(agency.id),
            account_number: String(agency.account_number),
            display_name: String(agency.display_name),
            status: String(agency.status),
            discount_basis_points: Number(agency.discount_basis_points),
            approved_credit_limit_cents: Number(
              agency.approved_credit_limit_cents,
            ),
            payment_terms_days: Number(agency.payment_terms_days),
          }))}
        />
      </section>
    </main>
  );
}
