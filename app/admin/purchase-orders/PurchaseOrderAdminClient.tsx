"use client";

import { useState } from "react";

import styles from "./purchase-orders.module.css";

export interface PurchaseOrderReviewItem {
  id: string;
  poNumber: string;
  status: string;
  submittedAt: string;
  reviewerNote: string;
  orderId: string;
  orderNumber: string;
  totalCents: number;
  creditStatus: string;
  agencyName: string;
  accountNumber: string;
  documentId: string;
  documentVersion: number;
  filename: string;
}

export default function PurchaseOrderAdminClient({
  purchaseOrders,
}: {
  purchaseOrders: PurchaseOrderReviewItem[];
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

  async function declineSelected() {
    if (selectedIds.length === 0) {
      return;
    }

    setBusy("bulk-decline");
    setError("");

    try {
      const response = await fetch("/api/admin/list-actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entity: "purchaseOrder",
          action: "decline",
          ids: selectedIds,
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Selected purchase orders could not be declined.");
      }

      window.location.reload();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Selected purchase orders could not be declined.",
      );
    } finally {
      setBusy("");
    }
  }

  async function review(
    id: string,
    decision: "approve" | "revision" | "decline",
  ) {
    const note =
      (
        document.getElementById(
          `note-${id}`,
        ) as HTMLTextAreaElement | null
      )?.value ?? "";

    setBusy(id);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/purchase-orders/${id}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision,
            note,
          }),
        },
      );
      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ?? "PO review failed.",
        );
      }

      window.location.reload();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "PO review failed.",
      );
    } finally {
      setBusy("");
    }
  }

  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

  return (
    <section className={styles.list}>
      {error ? <p className={styles.error}>{error}</p> : null}
      {purchaseOrders.length > 0 ? (
        <p>
          <button
            type="button"
            disabled={busy === "bulk-decline" || selectedIds.length === 0}
            onClick={declineSelected}
          >
            {busy === "bulk-decline"
              ? "Declining…"
              : `Decline selected (${selectedIds.length})`}
          </button>
        </p>
      ) : null}

      {purchaseOrders.length === 0 ? (
        <p>No purchase orders are awaiting review.</p>
      ) : (
        purchaseOrders.map((po) => (
          <article className={styles.card} key={po.id}>
            <div className={styles.heading}>
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(po.id)}
                    onChange={() => toggleSelected(po.id)}
                    disabled={Boolean(busy)}
                  />{" "}
                  Select
                </label>
                <p>
                  {po.accountNumber} · {po.agencyName}
                </p>
                <h2>{po.orderNumber}</h2>
              </div>
              <strong>
                {currency.format(po.totalCents / 100)}
              </strong>
            </div>

            <dl>
              <div>
                <dt>PO number</dt>
                <dd>{po.poNumber}</dd>
              </div>
              <div>
                <dt>Credit status</dt>
                <dd>{po.creditStatus.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>Document</dt>
                <dd>
                  <a
                    href={`/api/purchase-orders/documents/${po.documentId}`}
                  >
                    Version {po.documentVersion} · {po.filename}
                  </a>
                </dd>
              </div>
            </dl>

            <label>
              <span>Reviewer note</span>
              <textarea id={`note-${po.id}`} rows={3} />
            </label>

            <div className={styles.actions}>
              <button
                disabled={busy === po.id}
                onClick={() => review(po.id, "approve")}
              >
                Approve PO
              </button>
              <button
                disabled={busy === po.id}
                onClick={() => review(po.id, "revision")}
              >
                Request revision
              </button>
              <button
                className={styles.decline}
                disabled={busy === po.id}
                onClick={() => review(po.id, "decline")}
              >
                Decline
              </button>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
