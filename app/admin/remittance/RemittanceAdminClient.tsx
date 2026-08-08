"use client";

import { FormEvent, useState } from "react";

import styles from "./remittance.module.css";

export default function RemittanceAdminClient() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch("/api/admin/remittance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: data.get("displayName"),
          bankName: data.get("bankName"),
          beneficiaryName: data.get("beneficiaryName"),
          accountType: data.get("accountType"),
          routingNumber: data.get("routingNumber"),
          accountNumber: data.get("accountNumber"),
          remittanceEmail: data.get("remittanceEmail"),
          achEnabled: data.get("achEnabled") === "on",
          wireEnabled: data.get("wireEnabled") === "on",
          instructions: data.get("instructions"),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Remittance account could not be saved.",
        );
      }

      setMessage(
        "Secure remittance account saved and made active.",
      );
      form.reset();
      window.location.reload();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Remittance account could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.eyebrow}>SECURE BANK SETUP</p>
      <h2>Add existing business bank account</h2>
      <p className={styles.help}>
        Routing and account numbers are encrypted in Supabase Vault.
        They are never stored in source code or GitHub.
      </p>

      <div className={styles.grid}>
        <label>
          <span>Internal display name</span>
          <input
            name="displayName"
            required
            placeholder="Banco Popular operating account"
          />
        </label>
        <label>
          <span>Bank name</span>
          <input name="bankName" required />
        </label>
        <label>
          <span>Beneficiary / legal account name</span>
          <input name="beneficiaryName" required />
        </label>
        <label>
          <span>Account type</span>
          <select name="accountType" defaultValue="checking">
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
          </select>
        </label>
        <label>
          <span>Routing number</span>
          <input
            name="routingNumber"
            inputMode="numeric"
            required
            minLength={9}
            maxLength={9}
          />
        </label>
        <label>
          <span>Account number</span>
          <input
            name="accountNumber"
            inputMode="numeric"
            required
            minLength={4}
            maxLength={24}
          />
        </label>
        <label>
          <span>Remittance email</span>
          <input
            name="remittanceEmail"
            type="email"
            defaultValue="processing@lagrandiosapr.com"
          />
        </label>
        <label className={styles.check}>
          <input
            name="achEnabled"
            type="checkbox"
            defaultChecked
          />
          <span>ACH enabled</span>
        </label>
        <label className={styles.check}>
          <input
            name="wireEnabled"
            type="checkbox"
            defaultChecked
          />
          <span>Wire enabled</span>
        </label>
        <label className={styles.full}>
          <span>Additional remittance instructions</span>
          <textarea name="instructions" rows={4} />
        </label>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? (
        <p className={styles.success}>{message}</p>
      ) : null}

      <button disabled={busy} type="submit">
        {busy
          ? "Saving securely…"
          : "Save active remittance account"}
      </button>
    </form>
  );
}
