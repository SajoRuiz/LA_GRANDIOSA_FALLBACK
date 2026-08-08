import Link from "next/link";
import { requireStaffAccess } from "@/lib/auth/access";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import NotificationAdminClient, {
  type NotificationRow,
} from "./NotificationAdminClient";
import styles from "./notifications.module.css";

export default async function NotificationsPage() {
  await requireStaffAccess("/admin/notifications", [
    "finance",
    "system_admin",
  ]);
  const config = getCommerceServerConfig();
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("notification_outbox")
    .select(
      "id,channel,template_key,recipient,status,category,priority,attempts,max_attempts,provider,provider_status,last_error,created_at,next_attempt_at,sent_at,delivered_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const notifications: NotificationRow[] = (data ?? []).map((row) => ({
    id: row.id,
    channel: row.channel,
    templateKey: row.template_key,
    recipient: row.recipient,
    status: row.status,
    category: row.category ?? "transactional",
    priority: Number(row.priority ?? 100),
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 6),
    provider: row.provider ?? "",
    providerStatus: row.provider_status ?? "",
    lastError: row.last_error ?? "",
    createdAt: row.created_at,
    nextAttemptAt: row.next_attempt_at ?? "",
    sentAt: row.sent_at ?? "",
    deliveredAt: row.delivered_at ?? "",
  }));

  const emailConfigured = Boolean(config.resendApiKey);
  const smsConfigured = Boolean(
    config.twilioAccountSid &&
      config.twilioAuthToken &&
      (config.twilioMessagingServiceSid || config.twilioFromNumber),
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin/assets">
          <img
            className={styles.logo}
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
        </Link>
        <nav>
          <Link href="/admin/assets">Assets</Link>
          <Link href="/admin/deadlines">Deadlines</Link>
          <Link href="/admin/releases">Releases</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <p>TRANSACTIONAL COMMUNICATIONS</p>
        <h1>Notification control center.</h1>
        <p>
          Email delivery: {emailConfigured ? "configured" : "queue only"}. SMS
          delivery: {smsConfigured ? "configured" : "queue only"}. Automated
          reminders use {config.businessTimeZone} business dates.
        </p>
      </section>

      <NotificationAdminClient notifications={notifications} />
    </main>
  );
}
