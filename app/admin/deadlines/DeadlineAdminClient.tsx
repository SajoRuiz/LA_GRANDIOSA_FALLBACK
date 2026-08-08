"use client";

import { FormEvent, useState } from "react";
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

      {orders.length === 0 ? (
        <p>No orders currently require asset-deadline administration.</p>
      ) : (
        orders.map((order) => (
          <article className={styles.card} key={order.id}>
            <div className={styles.heading}>
              <div>
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
                <input
                  name="dueDate"
                  type="date"
                  defaultValue={order.assetDueAt.slice(0, 10)}
                />
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
