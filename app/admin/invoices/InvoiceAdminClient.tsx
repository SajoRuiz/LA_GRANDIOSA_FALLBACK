"use client";

import { FormEvent, useState } from "react";

import styles from "./invoices.module.css";

interface ApprovedOrder {
  id: string;
  orderNumber: string;
  agencyName: string;
  totalCents: number;
}

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  agencyName: string;
  status: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  dueDate: string;
}

interface RemittanceAccountOption {
  id: string;
  displayName: string;
  bankName: string;
  last4: string;
}

export default function InvoiceAdminClient({
  approvedOrders,
  invoices,
  remittanceAccounts,
}: {
  approvedOrders: ApprovedOrder[];
  invoices: InvoiceRow[];
  remittanceAccounts: RemittanceAccountOption[];
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("issue");
    setError("");

    try {
      const response = await fetch("/api/admin/invoices/issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: data.get("orderId"),
          remittanceAccountId: data.get("remittanceAccountId"),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ?? "Invoice could not be issued.",
        );
      }

      window.location.reload();
    } catch (issueError) {
      setError(
        issueError instanceof Error
          ? issueError.message
          : "Invoice could not be issued.",
      );
    } finally {
      setBusy("");
    }
  }

  async function payment(
    event: FormEvent<HTMLFormElement>,
    invoiceId: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(invoiceId);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/invoices/${invoiceId}/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amountDollars: Number(data.get("amountDollars")),
            method: data.get("method"),
            receivedDate: data.get("receivedDate"),
            reference: data.get("reference"),
            note: data.get("note"),
          }),
        },
      );
      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ?? "Payment could not be recorded.",
        );
      }

      window.location.reload();
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Payment could not be recorded.",
      );
    } finally {
      setBusy("");
    }
  }

  const money = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);

  return (
    <section className={styles.workspace}>
      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.panel}>
        <h2>Issue approved invoice</h2>
        {approvedOrders.length === 0 ? (
          <p>No PO-approved orders are waiting for an invoice.</p>
        ) : remittanceAccounts.length === 0 ? (
          <p>
            Add an active remittance account before issuing an
            invoice.
          </p>
        ) : (
          <form className={styles.form} onSubmit={issue}>
            <label>
              <span>Approved order</span>
              <select name="orderId" required defaultValue="">
                <option value="" disabled>
                  Select order
                </option>
                {approvedOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} · {order.agencyName} ·{" "}
                    {money(order.totalCents)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Active remittance account</span>
              <select
                name="remittanceAccountId"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select bank account
                </option>
                {remittanceAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName} · {account.bankName} ·{" "}
                    {account.last4}
                  </option>
                ))}
              </select>
            </label>

            <button disabled={busy === "issue"} type="submit">
              Issue invoice
            </button>
          </form>
        )}
      </section>

      <section className={styles.panel}>
        <h2>Invoice register and payments</h2>
        <div className={styles.list}>
          {invoices.length === 0 ? (
            <p>No invoices have been issued.</p>
          ) : (
            invoices.map((invoice) => (
              <article className={styles.card} key={invoice.id}>
                <div className={styles.heading}>
                  <div>
                    <p>{invoice.agencyName}</p>
                    <h3>{invoice.invoiceNumber}</h3>
                  </div>
                  <strong>{money(invoice.balanceCents)}</strong>
                </div>

                <dl>
                  <div>
                    <dt>Status</dt>
                    <dd>{invoice.status.replaceAll("_", " ")}</dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd>{money(invoice.totalCents)}</dd>
                  </div>
                  <div>
                    <dt>Paid</dt>
                    <dd>{money(invoice.paidCents)}</dd>
                  </div>
                  <div>
                    <dt>Due date</dt>
                    <dd>{invoice.dueDate}</dd>
                  </div>
                </dl>

                <div className={styles.links}>
                  <a href={`/api/invoices/${invoice.id}/pdf`}>
                    Download PDF
                  </a>
                </div>

                {invoice.balanceCents > 0 ? (
                  <form
                    className={styles.payment}
                    onSubmit={(event) =>
                      payment(event, invoice.id)
                    }
                  >
                    <label>
                      <span>Amount $</span>
                      <input
                        name="amountDollars"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={(invoice.balanceCents / 100).toFixed(2)}
                        required
                      />
                    </label>
                    <label>
                      <span>Method</span>
                      <select name="method" defaultValue="ach">
                        <option value="ach">ACH</option>
                        <option value="wire">Wire</option>
                        <option value="check">Check</option>
                        <option value="manual">Other manual</option>
                      </select>
                    </label>
                    <label>
                      <span>Received date</span>
                      <input
                        name="receivedDate"
                        type="date"
                        required
                        defaultValue={new Date()
                          .toISOString()
                          .slice(0, 10)}
                      />
                    </label>
                    <label>
                      <span>Reference</span>
                      <input name="reference" />
                    </label>
                    <label className={styles.full}>
                      <span>Note</span>
                      <textarea name="note" rows={2} />
                    </label>
                    <button
                      disabled={busy === invoice.id}
                      type="submit"
                    >
                      Record payment
                    </button>
                  </form>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
