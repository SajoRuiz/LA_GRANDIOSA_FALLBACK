import Link from "next/link";

import { requireStaffAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import RemittanceAdminClient from "./RemittanceAdminClient";
import styles from "./remittance.module.css";

export default async function RemittanceAdminPage() {
  await requireStaffAccess("/admin/remittance", [
    "finance",
    "system_admin",
  ]);
  const admin = createSupabaseAdminClient();
  const { data: accounts } = await admin
    .from("remittance_accounts")
    .select(
      "id,display_name,bank_name,beneficiary_name,account_type,account_last4,remittance_email,ach_enabled,wire_enabled,active,created_at",
    )
    .order("created_at", { ascending: false });

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
          <Link href="/admin/invoices">Invoices</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <p>FINANCE ADMINISTRATION</p>
        <h1>Bank remittance.</h1>
      </section>

      <div className={styles.layout}>
        <RemittanceAdminClient />

        <section className={styles.panel}>
          <h2>Account register</h2>
          {(accounts ?? []).length === 0 ? (
            <p>No remittance account has been configured.</p>
          ) : (
            (accounts ?? []).map((account) => (
              <article className={styles.account} key={account.id}>
                <div>
                  <strong>{account.display_name}</strong>
                  <span>
                    {account.active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <p>
                  {account.bank_name} · {account.account_type} ending{" "}
                  {account.account_last4}
                </p>
                <p>{account.beneficiary_name}</p>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
