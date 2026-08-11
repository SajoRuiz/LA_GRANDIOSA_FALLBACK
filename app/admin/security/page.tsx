import Link from "next/link";

import { requireStaffAccess } from "@/lib/auth/access";
import { getCommerceServerConfig } from "@/lib/server/config";
import {
  getStage6SecurityReport,
  type Stage6SecurityReport,
} from "@/lib/server/security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import SecurityAdminClient from "./SecurityAdminClient";
import styles from "./security.module.css";

function resultClass(ok: boolean): string {
  return ok ? styles.pass : styles.fail;
}

function issueCount(report: Stage6SecurityReport): number {
  return (
    report.rlsMissing.length +
    report.anonGrants.length +
    report.publicBuckets.length +
    report.activeStaffWithoutVerifiedMfa +
    report.activeBuyersWithoutVerifiedMfa +
    report.expiredPendingInvites +
    report.deadLetterNotifications +
    report.failedReleaseQueueItems
  );
}

export default async function SecurityAdministrationPage() {
  await requireStaffAccess("/admin/security", [
    "system_admin",
  ]);

  const config = getCommerceServerConfig();
  const report = await getStage6SecurityReport();
  const admin = createSupabaseAdminClient();

  const [{ data: snapshots }, { data: events }] =
    await Promise.all([
      admin
        .from("security_audit_snapshots")
        .select("id,generated_at,notes")
        .order("generated_at", { ascending: false })
        .limit(10),
      admin
        .from("security_events")
        .select(
          "id,occurred_at,event_key,severity,actor_email,route,request_method,metadata",
        )
        .order("occurred_at", { ascending: false })
        .limit(50),
    ]);

  const blockers = issueCount(report);
  const environmentChecks = [
    {
      label: "Production application URL",
      ok:
        process.env.NODE_ENV !== "production" ||
        config.appBaseUrl.startsWith("https://"),
      detail: config.appBaseUrl,
    },
    {
      label: "Security hash salt",
      ok:
        process.env.NODE_ENV !== "production" ||
        config.securityHashSalt.length >= 32,
      detail:
        config.securityHashSalt ===
        "la-grandiosa-local-development-only"
          ? "Local-development fallback"
          : "Configured",
    },
    {
      label: "Cron authorization",
      ok: Boolean(config.cronSecret),
      detail: config.cronSecret
        ? "Configured"
        : "Manual staff execution only",
    },
    {
      label: "Email provider",
      ok: Boolean(
        config.resendApiKey &&
          config.resendWebhookSecret,
      ),
      detail: config.resendApiKey
        ? "Configured"
        : "Queue only",
    },
    {
      label: "SMS provider",
      ok: Boolean(
        config.twilioAccountSid &&
          config.twilioAuthToken &&
          (config.twilioMessagingServiceSid ||
            config.twilioFromNumber),
      ),
      detail:
        config.twilioAccountSid
          ? "Configured"
          : "Not configured / may be waived",
    },
    {
      label: "LED delivery provider",
      ok: config.ledProviderMode === "manual",
      detail:
        config.ledProviderMode === "manual"
          ? "Manual release approved until API confirmation"
          : "API adapter selected",
    },
  ];

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
          <Link href="/admin/launch">Launch checklist</Link>
          <Link href="/admin/notifications">Notifications</Link>
          <Link href="/admin/releases">Releases</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <p>PRODUCTION SECURITY</p>
        <h1>Security and readiness audit.</h1>
        <p>
          Current automatic issue count: <strong>{blockers}</strong>.
          Required launch checklist items still open:{" "}
          <strong>{report.requiredLaunchChecksOpen}</strong>.
        </p>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <h2>Database and access controls</h2>
          <dl className={styles.checks}>
            <div>
              <dt>Critical tables missing RLS</dt>
              <dd className={resultClass(report.rlsMissing.length === 0)}>
                {report.rlsMissing.length === 0
                  ? "PASS"
                  : report.rlsMissing.join(", ")}
              </dd>
            </div>
            <div>
              <dt>Anonymous private-table grants</dt>
              <dd className={resultClass(report.anonGrants.length === 0)}>
                {report.anonGrants.length === 0
                  ? "PASS"
                  : `${report.anonGrants.length} issue(s)`}
              </dd>
            </div>
            <div>
              <dt>Public storage buckets</dt>
              <dd className={resultClass(report.publicBuckets.length === 0)}>
                {report.publicBuckets.length === 0
                  ? "PASS"
                  : report.publicBuckets.join(", ")}
              </dd>
            </div>
            <div>
              <dt>Active staff without verified MFA</dt>
              <dd
                className={resultClass(
                  report.activeStaffWithoutVerifiedMfa === 0,
                )}
              >
                {report.activeStaffWithoutVerifiedMfa}
              </dd>
            </div>
            <div>
              <dt>Active buyers without verified MFA</dt>
              <dd
                className={resultClass(
                  report.activeBuyersWithoutVerifiedMfa === 0,
                )}
              >
                {report.activeBuyersWithoutVerifiedMfa}
              </dd>
            </div>
            <div>
              <dt>Expired pending invitations</dt>
              <dd
                className={resultClass(
                  report.expiredPendingInvites === 0,
                )}
              >
                {report.expiredPendingInvites}
              </dd>
            </div>
          </dl>
        </article>

        <article className={styles.panel}>
          <h2>Operational risk</h2>
          <dl className={styles.checks}>
            <div>
              <dt>Dead-letter notifications</dt>
              <dd
                className={resultClass(
                  report.deadLetterNotifications === 0,
                )}
              >
                {report.deadLetterNotifications}
              </dd>
            </div>
            <div>
              <dt>Failed release-queue items</dt>
              <dd
                className={resultClass(
                  report.failedReleaseQueueItems === 0,
                )}
              >
                {report.failedReleaseQueueItems}
              </dd>
            </div>
            <div>
              <dt>Active remittance accounts</dt>
              <dd
                className={resultClass(
                  report.activeRemittanceAccounts === 1,
                )}
              >
                {report.activeRemittanceAccounts}
              </dd>
            </div>
            <div>
              <dt>Overdue open invoices</dt>
              <dd
                className={
                  report.overdueInvoices === 0
                    ? styles.pass
                    : styles.warning
                }
              >
                {report.overdueInvoices}
              </dd>
            </div>
          </dl>
        </article>

        <article className={styles.panel}>
          <h2>Environment readiness</h2>
          <dl className={styles.checks}>
            {environmentChecks.map((check) => (
              <div key={check.label}>
                <dt>{check.label}</dt>
                <dd className={resultClass(check.ok)}>
                  {check.ok ? "PASS" : "ACTION"} · {check.detail}
                </dd>
              </div>
            ))}
          </dl>
        </article>

        <article className={styles.panel}>
          <h2>Audit operations</h2>
          <p>
            Save a time-stamped report before each production
            release. Rate-limit cleanup removes only expired
            development and operational counters.
          </p>
          <SecurityAdminClient />
        </article>
      </section>

      <section className={styles.tables}>
        <article className={styles.panel}>
          <h2>Recent security events</h2>
          <div className={styles.table}>
            {(events ?? []).map((event) => (
              <div className={styles.row} key={event.id}>
                <span>{event.severity}</span>
                <strong>{event.event_key}</strong>
                <span>{event.actor_email || "anonymous"}</span>
                <span>{event.route || "—"}</span>
                <time>{new Date(event.occurred_at).toLocaleString("en-US")}</time>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <h2>Saved audit snapshots</h2>
          <div className={styles.table}>
            {(snapshots ?? []).map((snapshot) => (
              <div className={styles.row} key={snapshot.id}>
                <strong>{snapshot.id.slice(0, 8)}</strong>
                <span>{snapshot.notes || "No notes"}</span>
                <time>
                  {new Date(snapshot.generated_at).toLocaleString("en-US")}
                </time>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
