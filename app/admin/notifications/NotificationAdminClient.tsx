"use client";

import { useState } from "react";
import styles from "./notifications.module.css";

export interface NotificationRow {
  id: string;
  channel: string;
  templateKey: string;
  recipient: string;
  status: string;
  category: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  provider: string;
  providerStatus: string;
  lastError: string;
  createdAt: string;
  nextAttemptAt: string;
  sentAt: string;
  deliveredAt: string;
}

export default function NotificationAdminClient({
  notifications,
}: {
  notifications: NotificationRow[];
}) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function invoke(
    key: string,
    url: string,
    options: RequestInit = { method: "POST" },
  ) {
    setBusy(key);
    setMessage("");
    setError("");

    try {
      const response = await fetch(url, options);
      const result = (await response.json().catch(() => ({}))) as Record<
        string,
        any
      >;
      if (!response.ok) {
        throw new Error(result.error ?? "The operation failed.");
      }

      if (key === "deliver") {
        setMessage(
          `Claimed ${result.claimed ?? 0} notification(s) for delivery.`,
        );
      } else if (key === "reminders") {
        setMessage(
          `Reminder scan prepared ${result.queued?.prepared ?? 0} notification(s).`,
        );
      } else {
        setMessage("Notification status updated.");
      }

      window.location.reload();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The operation failed.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <section className={styles.controls}>
        {error ? <p className={styles.error}>{error}</p> : null}
        {message ? <p className={styles.success}>{message}</p> : null}
        <div className={styles.controlButtons}>
          <button
            disabled={Boolean(busy)}
            onClick={() =>
              invoke("deliver", "/api/internal/notifications/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ limit: 50 }),
              })
            }
          >
            {busy === "deliver"
              ? "Sending…"
              : "Send queued notifications now"}
          </button>
          <button
            className={styles.secondaryButton}
            disabled={Boolean(busy)}
            onClick={() =>
              invoke("reminders", "/api/admin/reminders/run", {
                method: "POST",
              })
            }
          >
            {busy === "reminders"
              ? "Scanning…"
              : "Run reminders now"}
          </button>
        </div>
      </section>

      <section className={styles.table}>
        {notifications.length === 0 ? (
          <p>No notification records are available.</p>
        ) : (
          notifications.map((row) => (
            <article key={row.id}>
              <div className={styles.notificationHeading}>
                <div>
                  <strong>{row.templateKey}</strong>
                  <span>
                    {row.channel} · {row.recipient}
                  </span>
                </div>
                <b className={`${styles.status} ${styles[`status_${row.status}`] ?? ""}`}>
                  {row.status.replaceAll("_", " ")}
                </b>
              </div>

              <dl>
                <div>
                  <dt>Category</dt>
                  <dd>{row.category}</dd>
                </div>
                <div>
                  <dt>Provider</dt>
                  <dd>{row.provider || "—"}</dd>
                </div>
                <div>
                  <dt>Provider status</dt>
                  <dd>{row.providerStatus || "—"}</dd>
                </div>
                <div>
                  <dt>Attempts</dt>
                  <dd>
                    {row.attempts} / {row.maxAttempts}
                  </dd>
                </div>
                <div>
                  <dt>Priority</dt>
                  <dd>{row.priority}</dd>
                </div>
                <div>
                  <dt>Next attempt</dt>
                  <dd>
                    {row.nextAttemptAt
                      ? new Date(row.nextAttemptAt).toLocaleString("en-US")
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Sent</dt>
                  <dd>
                    {row.sentAt
                      ? new Date(row.sentAt).toLocaleString("en-US")
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Delivered</dt>
                  <dd>
                    {row.deliveredAt
                      ? new Date(row.deliveredAt).toLocaleString("en-US")
                      : "—"}
                  </dd>
                </div>
              </dl>

              {row.lastError ? (
                <p className={styles.lastError}>{row.lastError}</p>
              ) : null}

              {[
                "failed",
                "dead_letter",
                "cancelled",
              ].includes(row.status) ? (
                <div className={styles.rowActions}>
                  <button
                    disabled={Boolean(busy)}
                    onClick={() =>
                      invoke(
                        `retry-${row.id}`,
                        `/api/admin/notifications/${row.id}/retry`,
                        { method: "POST" },
                      )
                    }
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {["queued", "failed", "processing"].includes(row.status) ? (
                <div className={styles.rowActions}>
                  <button
                    className={styles.dangerButton}
                    disabled={Boolean(busy)}
                    onClick={() =>
                      invoke(
                        `cancel-${row.id}`,
                        `/api/admin/notifications/${row.id}/cancel`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            reason: "Cancelled from notification administration.",
                          }),
                        },
                      )
                    }
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>
    </>
  );
}
