"use client";

import { FormEvent, useState } from "react";

import styles from "./launch.module.css";

export interface LaunchItem {
  id: string;
  category: string;
  label: string;
  description: string;
  required: boolean;
  status: "pending" | "passed" | "waived" | "failed";
  evidence: string;
  reviewedAt: string;
}

export default function LaunchChecklistClient({
  items,
}: {
  items: LaunchItem[];
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }

  async function waiveSelected() {
    if (selectedIds.length === 0) {
      return;
    }

    setBusy("bulk-waive");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/list-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "launchChecklist",
          action: "waive",
          ids: selectedIds,
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Selected checklist items could not be waived.");
      }

      setMessage("Selected launch checklist items were waived.");
      window.location.reload();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Selected checklist items could not be waived.",
      );
    } finally {
      setBusy("");
    }
  }

  async function saveItem(
    event: FormEvent<HTMLFormElement>,
    itemId: string,
  ) {
    event.preventDefault();
    setBusy(itemId);
    setError("");
    setMessage("");

    const data = new FormData(event.currentTarget);

    try {
      const response = await fetch(
        `/api/admin/launch-checklist/${itemId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: data.get("status"),
            evidence: data.get("evidence"),
          }),
        },
      );
      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Launch item could not be updated.",
        );
      }

      setMessage("Launch checklist item updated.");
      window.location.reload();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Launch item could not be updated.",
      );
    } finally {
      setBusy("");
    }
  }

  async function signoff(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setBusy("signoff");
    setError("");
    setMessage("");

    const data = new FormData(event.currentTarget);

    try {
      const response = await fetch(
        "/api/admin/production-releases",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            releaseName: data.get("releaseName"),
            gitCommit: data.get("gitCommit"),
            deploymentUrl: data.get("deploymentUrl"),
            notes: data.get("notes"),
          }),
        },
      );
      const result = (await response.json()) as {
        error?: string;
        signoffId?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Production signoff could not be created.",
        );
      }

      setMessage(
        `Production release signed off: ${result.signoffId}`,
      );
      window.location.reload();
    } catch (signoffError) {
      setError(
        signoffError instanceof Error
          ? signoffError.message
          : "Production signoff could not be created.",
      );
    } finally {
      setBusy("");
    }
  }

  const grouped = items.reduce<Record<string, LaunchItem[]>>(
    (groups, item) => {
      groups[item.category] ||= [];
      groups[item.category].push(item);
      return groups;
    },
    {},
  );

  return (
    <>
      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? (
        <p className={styles.success}>{message}</p>
      ) : null}
      {items.length > 0 ? (
        <p>
          <button
            type="button"
            disabled={busy === "bulk-waive" || selectedIds.length === 0}
            onClick={waiveSelected}
          >
            {busy === "bulk-waive"
              ? "Waiving…"
              : `Waive selected (${selectedIds.length})`}
          </button>
        </p>
      ) : null}

      <section className={styles.groups}>
        {Object.entries(grouped).map(([category, rows]) => (
          <article className={styles.group} key={category}>
            <h2>{category}</h2>

            {rows.map((item) => (
              <form
                className={styles.item}
                key={item.id}
                onSubmit={(event) =>
                  saveItem(event, item.id)
                }
              >
                <div className={styles.itemCopy}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelected(item.id)}
                      disabled={Boolean(busy)}
                    />{" "}
                    Select
                  </label>
                  <p>
                    {item.required ? "REQUIRED" : "OPTIONAL"}
                  </p>
                  <h3>{item.label}</h3>
                  <span>{item.description}</span>
                </div>

                <label>
                  <span>Status</span>
                  <select
                    name="status"
                    defaultValue={item.status}
                  >
                    <option value="pending">Pending</option>
                    <option value="passed">Passed</option>
                    <option value="waived">Waived</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>

                <label className={styles.evidence}>
                  <span>Evidence / approval note</span>
                  <textarea
                    name="evidence"
                    rows={3}
                    defaultValue={item.evidence}
                  />
                </label>

                <button
                  type="submit"
                  disabled={Boolean(busy)}
                >
                  {busy === item.id
                    ? "Saving…"
                    : "Save"}
                </button>
              </form>
            ))}
          </article>
        ))}
      </section>

      <section className={styles.signoff}>
        <p>FINAL PRODUCTION AUTHORIZATION</p>
        <h2>Create release signoff.</h2>
        <p>
          The system blocks signoff until every required item
          is passed or formally waived.
        </p>

        <form onSubmit={signoff}>
          <label>
            <span>Release name</span>
            <input
              name="releaseName"
              required
              placeholder="La Grandiosa Commerce v1.0"
            />
          </label>

          <label>
            <span>Git commit</span>
            <input
              name="gitCommit"
              placeholder="Full production commit SHA"
            />
          </label>

          <label>
            <span>Production deployment URL</span>
            <input
              name="deploymentUrl"
              type="url"
              placeholder="https://www.lagrandiosapr.com"
            />
          </label>

          <label className={styles.full}>
            <span>Release notes</span>
            <textarea name="notes" rows={4} />
          </label>

          <button
            type="submit"
            disabled={Boolean(busy)}
          >
            {busy === "signoff"
              ? "Authorizing…"
              : "Authorize Production Release"}
          </button>
        </form>
      </section>
    </>
  );
}
