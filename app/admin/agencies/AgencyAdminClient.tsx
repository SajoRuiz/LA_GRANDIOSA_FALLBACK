"use client";

import { FormEvent, useState } from "react";
import styles from "./admin.module.css";

interface AgencyOption {
  id: string;
  account_number: string;
  display_name: string;
}

interface AgencyRegisterRow extends AgencyOption {
  status: string;
  discount_basis_points: number;
  approved_credit_limit_cents: number;
  payment_terms_days: number;
}

interface AgencyAdminClientProps {
  agencies: AgencyOption[];
  register: AgencyRegisterRow[];
}

export default function AgencyAdminClient({
  agencies,
  register,
}: AgencyAdminClientProps) {
  const [agencyMessage, setAgencyMessage] = useState("");
  const [agencyError, setAgencyError] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [inviteSummary, setInviteSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }

  async function suspendSelected() {
    if (selectedIds.length === 0) {
      return;
    }

    setBusy(true);
    setAgencyError("");

    try {
      const response = await fetch("/api/admin/list-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "agency",
          action: "suspend",
          ids: selectedIds,
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Agencies could not be suspended.");
      }

      window.location.reload();
    } catch (error) {
      setAgencyError(
        error instanceof Error ? error.message : "Agencies could not be suspended.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createAgency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAgencyMessage("");
    setAgencyError("");
    setBusy(true);

    const form = event.currentTarget;
    const data = new FormData(form);
    const domains = String(data.get("authorizedEmailDomains") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/api/admin/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: data.get("legalName"),
          displayName: data.get("displayName"),
          discountBasisPoints: Math.round(
            Number(data.get("discountPercent") ?? 0) * 100,
          ),
          approvedCreditLimitCents: Math.round(
            Number(data.get("creditLimitDollars") ?? 0) * 100,
          ),
          paymentTermsDays: Number(data.get("paymentTermsDays") ?? 30),
          discountPolicy: data.get("discountPolicy"),
          poRequired: data.get("poRequired") === "on",
          authorizedEmailDomains: domains,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        agency?: { account_number: string; display_name: string };
      };

      if (!response.ok || !result.agency) {
        throw new Error(result.error ?? "Agency account creation failed.");
      }

      setAgencyMessage(
        `${result.agency.display_name} created as ${result.agency.account_number}. Refresh this page before creating its first invitation.`,
      );
      form.reset();
    } catch (error) {
      setAgencyError(
        error instanceof Error ? error.message : "Agency account creation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteError("");
    setActivationCode("");
    setInviteSummary("");
    setBusy(true);

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch("/api/admin/agency-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyId: data.get("agencyId"),
          email: data.get("email"),
          role: data.get("role"),
          canPurchase: data.get("canPurchase") === "on",
          expiresInDays: Number(data.get("expiresInDays") ?? 7),
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        activationCode?: string;
        invite?: {
          email: string;
          agencyName: string;
          expiresAt: string;
        };
      };

      if (!response.ok || !result.activationCode || !result.invite) {
        throw new Error(result.error ?? "Agency invitation failed.");
      }

      setActivationCode(result.activationCode);
      setInviteSummary(
        `${result.invite.email} invited to ${result.invite.agencyName}. The separate activation code expires ${new Date(
          result.invite.expiresAt,
        ).toLocaleString()}.`,
      );
      form.reset();
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : "Agency invitation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>NEW AGENCY</p>
        <h2>Create negotiated account.</h2>
        {agencyError ? <p className={styles.error}>{agencyError}</p> : null}
        {agencyMessage ? (
          <p className={styles.success}>{agencyMessage}</p>
        ) : null}

        <form className={styles.form} onSubmit={createAgency}>
          <label className={styles.field}>
            <span>Legal name</span>
            <input name="legalName" required maxLength={180} />
          </label>

          <label className={styles.field}>
            <span>Display name</span>
            <input name="displayName" required maxLength={180} />
          </label>

          <div className={styles.fieldGridTwo}>
            <label className={styles.field}>
              <span>Negotiated discount %</span>
              <input
                name="discountPercent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue="0"
                required
              />
            </label>

            <label className={styles.field}>
              <span>Approved credit limit $</span>
              <input
                name="creditLimitDollars"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                required
              />
            </label>

            <label className={styles.field}>
              <span>Payment terms days</span>
              <input
                name="paymentTermsDays"
                type="number"
                min="0"
                max="365"
                defaultValue="30"
                required
              />
            </label>

            <label className={styles.field}>
              <span>Discount policy</span>
              <select name="discountPolicy" defaultValue="stack">
                <option value="stack">Stack with campaign pricing</option>
                <option value="best_of">Use best discount</option>
                <option value="agency_replaces_campaign">
                  Agency discount replaces campaign discount
                </option>
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span>Authorized email domains, comma separated</span>
            <input
              name="authorizedEmailDomains"
              placeholder="agency.com, affiliate.com"
            />
          </label>

          <label className={styles.checkbox}>
            <input name="poRequired" type="checkbox" defaultChecked />
            Purchase order required
          </label>

          <button className={styles.button} type="submit" disabled={busy}>
            Create agency account
          </button>
        </form>
      </section>

      <section className={styles.panel}>
        <p className={styles.eyebrow}>INVITE USER</p>
        <h2>Create secure agency access.</h2>
        {inviteError ? <p className={styles.error}>{inviteError}</p> : null}

        <form className={styles.form} onSubmit={createInvite}>
          <label className={styles.field}>
            <span>Agency</span>
            <select name="agencyId" required defaultValue="">
              <option value="" disabled>
                Select agency
              </option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.account_number} · {agency.display_name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>User email</span>
            <input name="email" type="email" required maxLength={254} />
          </label>

          <div className={styles.fieldGridTwo}>
            <label className={styles.field}>
              <span>Agency role</span>
              <select name="role" defaultValue="agency_buyer">
                <option value="agency_buyer">Agency buyer</option>
                <option value="agency_admin">Agency administrator</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Invitation valid days</span>
              <input
                name="expiresInDays"
                type="number"
                min="1"
                max="30"
                defaultValue="7"
                required
              />
            </label>
          </div>

          <label className={styles.checkbox}>
            <input name="canPurchase" type="checkbox" defaultChecked />
            Purchasing enabled
          </label>

          <button className={styles.button} type="submit" disabled={busy}>
            Send invitation and create code
          </button>
        </form>

        {activationCode ? (
          <aside className={styles.codeBox}>
            <strong>One-time activation code</strong>
            <code>{activationCode}</code>
            <p>{inviteSummary}</p>
            <p>
              Share the code separately from the invitation email. It is not
              recoverable after leaving this page.
            </p>
          </aside>
        ) : null}
      </section>

      <section className={`${styles.panel} ${styles.agencyList}`}>
        <p className={styles.eyebrow}>CURRENT AGENCIES</p>
        <h2>Account register</h2>
        {register.length > 0 ? (
          <p>
            <button
              className={styles.button}
              type="button"
              disabled={busy || selectedIds.length === 0}
              onClick={suspendSelected}
            >
              {busy
                ? "Suspending…"
                : `Suspend selected (${selectedIds.length})`}
            </button>
          </p>
        ) : null}

        {register.length === 0 ? (
          <p>No agency accounts have been created.</p>
        ) : (
          register.map((agency) => (
            <article className={styles.agencyRow} key={agency.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(agency.id)}
                  onChange={() => toggleSelected(agency.id)}
                  disabled={busy}
                />{" "}
                Select
              </label>
              <div>
                <strong>{agency.display_name}</strong>
                <span>{agency.account_number}</span>
              </div>
              <span>{agency.status}</span>
              <span>
                {(Number(agency.discount_basis_points) / 100).toFixed(2)}%
              </span>
              <span>
                {currency.format(
                  Number(agency.approved_credit_limit_cents) / 100,
                )}
              </span>
              <span>Net {agency.payment_terms_days}</span>
            </article>
          ))
        )}
      </section>
    </>
  );
}
