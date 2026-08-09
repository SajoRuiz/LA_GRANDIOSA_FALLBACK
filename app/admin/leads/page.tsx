import Link from "next/link";
import { requireStaffAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import LeadsClient from "./LeadsClient";
import styles from "./leads.module.css";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  await requireStaffAccess("/admin/leads", ["sales_reviewer", "finance", "system_admin"]);

  const admin = createSupabaseAdminClient();
  const { data: leads, error } = await admin
    .from("access_leads")
    .select("id,requester_name,requester_email,company_name,message,status,source,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin/agencies" aria-label="La Grandiosa admin home">
          <img className={styles.logo} src="/la-grandiosa-logo.png" alt="La Grandiosa" />
        </Link>
        <nav className={styles.nav}>
          <Link href="/admin/agencies">Agency accounts</Link>
          <Link href="/admin/credit">Credit</Link>
          <Link href="/admin/purchase-orders">PO review</Link>
          <Link href="/admin/invoices">Invoices</Link>
          <Link href="/admin/remittance">Remittance</Link>
        </nav>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>LEADS</p>
            <h1 className={styles.title}>Access requests</h1>
            <p className={styles.subtitle}>Review and route incoming access requests from the homepage form.</p>
          </div>
        </div>

        <LeadsClient leads={(leads ?? []) as any[]} />
      </section>
    </main>
  );
}
