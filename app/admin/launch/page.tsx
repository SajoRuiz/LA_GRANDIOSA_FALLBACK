import Link from "next/link";

import { requireStaffAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import LaunchChecklistClient, {
  type LaunchItem,
} from "./LaunchChecklistClient";
import styles from "./launch.module.css";

export default async function ProductionLaunchPage() {
  await requireStaffAccess("/admin/launch", [
    "system_admin",
  ]);

  const admin = createSupabaseAdminClient();
  const [{ data: checklist }, { data: signoffs }] =
    await Promise.all([
      admin
        .from("launch_checklist_items")
        .select(
          "id,category,label,description,required,status,evidence,reviewed_at,sort_order",
        )
        .order("sort_order", { ascending: true }),
      admin
        .from("production_release_signoffs")
        .select(
          "id,release_name,git_commit,deployment_url,status,notes,signed_at",
        )
        .order("signed_at", { ascending: false })
        .limit(20),
    ]);

  const items: LaunchItem[] = (checklist ?? []).map(
    (item) => ({
      id: item.id,
      category: item.category,
      label: item.label,
      description: item.description,
      required: Boolean(item.required),
      status: item.status,
      evidence: item.evidence ?? "",
      reviewedAt: item.reviewed_at ?? "",
    }),
  );

  const required = items.filter((item) => item.required);
  const completed = required.filter((item) =>
    ["passed", "waived"].includes(item.status),
  ).length;

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
          <Link href="/admin/security">Security audit</Link>
          <Link href="/admin/notifications">Notifications</Link>
          <Link href="/admin/releases">LED releases</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <p>PRODUCTION CERTIFICATION</p>
        <h1>Launch checklist.</h1>
        <p>
          Required completion: {completed} of {required.length}.
          Production signoff remains blocked until every required
          control is passed or formally waived.
        </p>
      </section>

      <LaunchChecklistClient items={items} />

      <section className={styles.history}>
        <h2>Release signoff history</h2>
        {(signoffs ?? []).length === 0 ? (
          <p>No production release has been signed off.</p>
        ) : (
          (signoffs ?? []).map((signoff) => (
            <article key={signoff.id}>
              <div>
                <strong>{signoff.release_name}</strong>
                <span>{signoff.status}</span>
              </div>
              <p>{signoff.deployment_url || "No URL recorded"}</p>
              <p>{signoff.git_commit || "No commit recorded"}</p>
              <time>
                {new Date(signoff.signed_at).toLocaleString(
                  "en-US",
                )}
              </time>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
