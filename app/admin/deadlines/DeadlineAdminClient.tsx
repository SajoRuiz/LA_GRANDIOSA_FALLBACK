"use client";

import { FormEvent, MouseEvent, useState } from "react";
import styles from "./deadlines.module.css";

export interface DeadlineOrder {
  id: string;
  orderNumber: string;
  agencyName: string;
  accountNumber: string;
  status: string;
  campaignStart: string;
  campaignEnd: string;
  assetDueAt: string;
  assetDueNote: string;
}

export default function DeadlineAdminClient({
  orders,
}: {
  orders: DeadlineOrder[];
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }

  function openDatePicker(event: MouseEvent<HTMLButtonElement>) {
    const input = event.currentTarget
      .closest("label")
      ?.querySelector("input[type='date']");

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const pickerInput = input as HTMLInputElement & {
      showPicker?: () => void;
    };

    if (typeof pickerInput.showPicker === "function") {
      pickerInput.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  async function clearSelected() {
    if (selectedIds.length === 0) {
      return;
    }

    setBusy("bulk-clear");
    setError("");

    try {
      const response = await fetch("/api/admin/list-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "deadline",
          action: "clear",
          ids: selectedIds,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Selected deadlines could not be cleared.");
      }

      window.location.reload();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Selected deadlines could not be cleared.",
      );
    } finally {
      setBusy("");
    }
  }

  async function save(
    event: FormEvent<HTMLFormElement>,
    orderId: string,
  ) {
    event.preventDefault();
    setBusy(orderId);
    setError("");

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/asset-deadline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dueDate: form.get("dueDate"),
            note: form.get("note"),
          }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Deadline could not be saved.");
      }

      window.location.reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Deadline could not be saved.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <section className={styles.list}>
      {error ? <p className={styles.error}>{error}</p> : null}
      {orders.length > 0 ? (
        <p>
          <button
            type="button"
            disabled={busy === "bulk-clear" || selectedIds.length === 0}
            onClick={clearSelected}
          >
            {busy === "bulk-clear"
              ? "Clearing…"
              : `Clear selected deadlines (${selectedIds.length})`}
          </button>
        </p>
      ) : null}

      {orders.length === 0 ? (
        <p>No orders currently require asset-deadline administration.</p>
      ) : (
        orders.map((order) => (
          <article className={styles.card} key={order.id}>
            <div className={styles.heading}>
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(order.id)}
                    onChange={() => toggleSelected(order.id)}
                    disabled={Boolean(busy)}
                  />{" "}
                  Select
                </label>
                <p>
                  {order.accountNumber} · {order.agencyName}
                </p>
                <h2>{order.orderNumber}</h2>
              </div>
              <b>{order.status.replaceAll("_", " ")}</b>
            </div>

            <dl>
              <div>
                <dt>Campaign start</dt>
                <dd>{order.campaignStart || "—"}</dd>
              </div>
              <div>
                <dt>Campaign end</dt>
                <dd>{order.campaignEnd || "—"}</dd>
              </div>
              <div>
                <dt>Current deadline</dt>
                <dd>
                  {order.assetDueAt
                    ? new Date(order.assetDueAt).toLocaleString("en-US")
                    : "Not assigned"}
                </dd>
              </div>
            </dl>

            <form onSubmit={(event) => save(event, order.id)}>
              <label>
                <span>Asset due date</span>
                <div className={styles.dateControl}>
                  <input
                    className={styles.dateInput}
                    name="dueDate"
                    type="date"
                    defaultValue={order.assetDueAt.slice(0, 10)}
                  />
                  <button
                    aria-label={`Open calendar for ${order.orderNumber}`}
                    className={styles.calendarTrigger}
                    onClick={openDatePicker}
                    type="button"
                  />
                </div>
              </label>
              <label className={styles.note}>
                <span>Client-facing note</span>
                <textarea
                  name="note"
                  rows={3}
                  maxLength={1000}
                  defaultValue={order.assetDueNote}
                />
              </label>
              <button disabled={busy === order.id} type="submit">
                {busy === order.id ? "Saving…" : "Save deadline"}
              </button>
            </form>
          </article>
        ))
      )}
    </section>
  );
}
