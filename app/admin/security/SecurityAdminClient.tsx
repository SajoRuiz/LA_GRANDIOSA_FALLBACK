"use client";

import { useState } from "react";

import styles from "./security.module.css";

export default function SecurityAdminClient() {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run(
    action: "snapshot" | "purge-rate-limits",
  ) {
    setBusy(action);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/security/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes:
            action === "snapshot"
              ? "Stage 6 administrator audit snapshot."
              : "",
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        snapshotId?: string;
        purgedBuckets?: number;
      };

      if (!response.ok) {
        throw new Error(
          result.error ?? "Security action failed.",
        );
      }

      setMessage(
        action === "snapshot"
          ? `Audit snapshot saved: ${result.snapshotId}`
          : `${result.purgedBuckets ?? 0} expired rate-limit bucket(s) removed.`,
      );

      window.location.reload();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Security action failed.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div className={styles.actions}>
      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? (
        <p className={styles.success}>{message}</p>
      ) : null}

      <button
        type="button"
        disabled={Boolean(busy)}
        onClick={() => run("snapshot")}
      >
        {busy === "snapshot"
          ? "Saving…"
          : "Save Audit Snapshot"}
      </button>

      <button
        className={styles.secondary}
        type="button"
        disabled={Boolean(busy)}
        onClick={() => run("purge-rate-limits")}
      >
        {busy === "purge-rate-limits"
          ? "Cleaning…"
          : "Purge Expired Rate Limits"}
      </button>
    </div>
  );
}
