"use client";

import { FormEvent, useState } from "react";
import styles from "./credit.module.css";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

interface Summary {
  agency: {
    id: string;
    accountNumber: string;
    displayName: string;
    status: string;
  };
  credit: {
    approvedCreditLimitCents: number;
    ledgerExposureCents: number;
    activeHoldExposureCents: number;
    pendingExceptionCents: number;
    currentExposureCents: number;
    availableCreditCents: number;
  };
}

interface Review {
  id: string;
  requested_amount_cents: number | string;
  available_credit_cents: number | string;
  shortfall_cents: number | string;
  created_at: string;
  agency_accounts:
    | { display_name: string; account_number: string }
    | Array<{ display_name: string; account_number: string }>
    | null;
  orders:
    | { order_number: string; net_contract_total_cents: number | string }
    | Array<{ order_number: string; net_contract_total_cents: number | string }>
    | null;
}

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function CreditAdminClient({
  summaries,
  reviews,
}: {
  summaries: Summary[];
  reviews: Review[];
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
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

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/list-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "creditReview",
          action: "decline",
          ids: selectedIds,
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Credit reviews could not be declined.");
      }

      setMessage("Selected credit exceptions were declined.");
      window.location.reload();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Credit reviews could not be declined.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resolveReview(
    reviewId: string,
    decision: "approve" | "decline",
    note: string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/credit-reviews/${reviewId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, note }),
        },
      );
      const text = await response.text();
      let result:
        | {
            error?: string;
            orderNumber?: string;
          }
        | undefined;

      try {
        result = text
          ? (JSON.parse(text) as {
              error?: string;
              orderNumber?: string;
            })
          : undefined;
      } catch {
        result = undefined;
      }

      if (!response.ok) {
        throw new Error(
          result?.error ?? text ?? "Credit review update failed.",
        );
      }

      const orderNumber = result?.orderNumber ?? "Order";

      setMessage(
        `${orderNumber} credit exception ${
          decision === "approve" ? "approved" : "declined"
        }.`,
      );
      window.location.reload();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Credit review update failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const agencyId = String(data.get("agencyId") ?? "");

    try {
      const response = await fetch(
        `/api/admin/agencies/${agencyId}/credit-ledger`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryType: data.get("entryType"),
            amountDollars: Number(data.get("amountDollars") ?? 0),
            reference: data.get("reference"),
            note: data.get("note"),
          }),
        },
      );
      const text = await response.text();
      let result: { error?: string } | undefined;

      try {
        result = text ? (JSON.parse(text) as { error?: string }) : undefined;
      } catch {
        result = undefined;
      }

      if (!response.ok) {
        throw new Error(
          result?.error ?? text ?? "Credit adjustment failed.",
        );
      }

      setMessage("Credit ledger entry recorded.");
      form.reset();
      window.location.reload();
    } catch (adjustmentError) {
      setError(
        adjustmentError instanceof Error
          ? adjustmentError.message
          : "Credit adjustment failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.workspace}>
      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.success}>{message}</p> : null}

      <section className={styles.panel}>
        <p className={styles.eyebrow}>AGENCY CREDIT REGISTER</p>
        <h2>Limits and exposure</h2>
        <div className={styles.summaryGrid}>
          {summaries.map(({ agency, credit }) => (
            <article className={styles.summaryCard} key={agency.id}>
              <div className={styles.summaryHeading}>
                <strong>{agency.displayName}</strong>
                <span>{agency.accountNumber}</span>
              </div>
              <dl className={styles.details}>
                <div>
                  <dt>Approved limit</dt>
                  <dd>{currency.format(credit.approvedCreditLimitCents / 100)}</dd>
                </div>
                <div>
                  <dt>Ledger exposure</dt>
                  <dd>{currency.format(credit.ledgerExposureCents / 100)}</dd>
                </div>
                <div>
                  <dt>Active holds</dt>
                  <dd>{currency.format(credit.activeHoldExposureCents / 100)}</dd>
                </div>
                <div>
                  <dt>Available credit</dt>
                  <dd className={styles.available}>
                    {currency.format(credit.availableCreditCents / 100)}
                  </dd>
                </div>
                <div>
                  <dt>Pending exceptions</dt>
                  <dd>{currency.format(credit.pendingExceptionCents / 100)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.eyebrow}>PENDING EXCEPTIONS</p>
        <h2>Finance review queue</h2>
        {reviews.length > 0 ? (
          <p>
            <button
              type="button"
              disabled={busy || selectedIds.length === 0}
              onClick={declineSelected}
            >
              {busy
                ? "Declining…"
                : `Decline selected (${selectedIds.length})`}
            </button>
          </p>
        ) : null}
        {reviews.length === 0 ? (
          <p className={styles.empty}>No credit exceptions are pending.</p>
        ) : (
          <div className={styles.reviewList}>
            {reviews.map((review) => {
              const agency = firstRelation(review.agency_accounts);
              const order = firstRelation(review.orders);

              return (
                <article className={styles.reviewCard} key={review.id}>
                  <div>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(review.id)}
                        onChange={() => toggleSelected(review.id)}
                        disabled={busy}
                      />{" "}
                      Select
                    </label>
                    <strong>{agency?.display_name ?? "Agency"}</strong>
                    <span>
                      {agency?.account_number ?? ""} · {order?.order_number ?? ""}
                    </span>
                  </div>
                  <dl className={styles.details}>
                    <div>
                      <dt>Requested</dt>
                      <dd>
                        {currency.format(Number(review.requested_amount_cents) / 100)}
                      </dd>
                    </div>
                    <div>
                      <dt>Available</dt>
                      <dd>
                        {currency.format(Number(review.available_credit_cents) / 100)}
                      </dd>
                    </div>
                    <div>
                      <dt>Shortfall</dt>
                      <dd className={styles.shortfall}>
                        {currency.format(Number(review.shortfall_cents) / 100)}
                      </dd>
                    </div>
                  </dl>
                  <label className={styles.field}>
                    <span>Finance note</span>
                    <textarea id={`note-${review.id}`} rows={3} />
                  </label>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        resolveReview(
                          review.id,
                          "approve",
                          (document.getElementById(
                            `note-${review.id}`,
                          ) as HTMLTextAreaElement | null)?.value ?? "",
                        )
                      }
                    >
                      Approve exception
                    </button>
                    <button
                      className={styles.declineButton}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        resolveReview(
                          review.id,
                          "decline",
                          (document.getElementById(
                            `note-${review.id}`,
                          ) as HTMLTextAreaElement | null)?.value ?? "",
                        )
                      }
                    >
                      Decline
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <p className={styles.eyebrow}>CREDIT LEDGER</p>
        <h2>Record opening balance or adjustment</h2>
        <p className={styles.help}>
          Opening balances, invoices, and debit adjustments increase exposure.
          Payments, credits, and write-offs reduce exposure automatically.
          Invoice automation is added in Stage 3B-C.
        </p>
        <form className={styles.form} onSubmit={addAdjustment}>
          <label className={styles.field}>
            <span>Agency</span>
            <select name="agencyId" required defaultValue="">
              <option value="" disabled>
                Select agency
              </option>
              {summaries.map(({ agency }) => (
                <option key={agency.id} value={agency.id}>
                  {agency.accountNumber} · {agency.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Entry type</span>
            <select name="entryType" defaultValue="opening_balance">
              <option value="opening_balance">Opening balance</option>
              <option value="debit_adjustment">Debit adjustment</option>
              <option value="credit_adjustment">Credit adjustment</option>
              <option value="payment">Payment</option>
              <option value="credit_memo">Credit memo</option>
              <option value="write_off">Write-off</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Amount $</span>
            <input
              name="amountDollars"
              type="number"
              step="0.01"
              required
              placeholder="2500"
            />
          </label>
          <label className={styles.field}>
            <span>Reference</span>
            <input name="reference" maxLength={100} />
          </label>
          <label className={`${styles.field} ${styles.fieldFull}`}>
            <span>Note</span>
            <textarea name="note" rows={3} maxLength={1000} />
          </label>
          <button type="submit" disabled={busy}>
            Record ledger entry
          </button>
        </form>
      </section>
    </section>
  );
}
