import Link from "next/link";
import { requireStaffAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import styles from "./assets.module.css";

export default async function AssetReviewQueuePage() {
  await requireStaffAccess("/admin/assets", ["sales_reviewer", "system_admin"]);
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("asset_submissions").select("id,submission_number,status,submitted_at,orders(id,order_number,client_snapshot,agency_accounts(display_name,account_number))").in("status", ["submitted","under_review"]).order("submitted_at", { ascending: true });
  return <main className={styles.page}><header className={styles.header}><Link href="/admin/agencies"><img className={styles.logo} src="/la-grandiosa-logo.png" alt="La Grandiosa" /></Link><nav><Link href="/admin/deadlines">Deadlines</Link><Link href="/admin/releases">Release queue</Link><Link href="/admin/notifications">Notifications</Link></nav></header><section className={styles.hero}><p>PRIVATE SALES TEAM ACCESS</p><h1>Asset review repository.</h1><p>Preview final files, preserve every version, approve the submission, or request screen-specific revisions.</p></section><section className={styles.queue}>{(data ?? []).length === 0 ? <p>No asset submissions are awaiting review.</p> : (data ?? []).map((submission) => { const order = Array.isArray(submission.orders) ? submission.orders[0] : submission.orders; const agency = Array.isArray(order?.agency_accounts) ? order?.agency_accounts[0] : order?.agency_accounts; return <article className={styles.queueCard} key={submission.id}><div><p>{agency?.account_number} · {agency?.display_name}</p><h2>{order?.order_number}</h2></div><dl><div><dt>Submission</dt><dd>{submission.submission_number}</dd></div><div><dt>Status</dt><dd>{submission.status.replaceAll("_"," ")}</dd></div><div><dt>Received</dt><dd>{new Date(submission.submitted_at).toLocaleString("en-US")}</dd></div></dl><Link href={`/admin/assets/${submission.id}`}>Review assets</Link></article>; })}</section></main>;
}
