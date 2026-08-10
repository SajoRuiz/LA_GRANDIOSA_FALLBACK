import Link from "next/link";

import { requireAgencyPurchaseAccess } from "@/lib/auth/access";
import { getAgencyCreditSummary } from "@/lib/server/agency-credit";
import { getCommerceServerConfig } from "@/lib/server/config";

import styles from "./portal.module.css";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function percentage(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(
    basisPoints % 100 === 0 ? 0 : 2,
  )}%`;
}

export default async function AgencyPortalPage() {
  const access = await requireAgencyPurchaseAccess("/portal");
  const credit = await getAgencyCreditSummary(access.agency.id);
  const config = getCommerceServerConfig();
  const termsRequestSubject = `Negotiated terms request - ${access.agency.account_number}`;
  const termsRequestBody = [
    "Hello Admin Team,",
    "",
    "I would like to request a review of our negotiated agency terms.",
    "",
    `Agency account: ${access.agency.account_number}`,
    `Agency name: ${access.agency.display_name}`,
    `Current discount: ${percentage(access.agency.discount_basis_points)}`,
    `Current payment terms: Net ${access.agency.payment_terms_days}`,
    `Current approved credit limit: ${currency.format(credit.approvedCreditLimitCents / 100)}`,
    "",
    "Requested terms:",
    "- Discount:",
    "- Payment date limit:",
    "- Credit limit:",
    "",
    `Requester: ${access.profile.full_name} (${access.profile.email})`,
  ].join("\n");
  const termsRequestHref = `mailto:${config.internalProcessingEmail}?subject=${encodeURIComponent(termsRequestSubject)}&body=${encodeURIComponent(termsRequestBody)}`;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/">
          <img
            className={styles.logo}
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
        </Link>
        <div className={styles.headerActions}>
          <Link href="/portal/orders">Orders</Link>
          <Link href="/portal/invoices">Invoices</Link>
          <Link href="/cart">Contract cart</Link>
          <form action="/auth/signout" method="post">
            <button className={styles.signout} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>PRIVATE AGENCY PORTAL</p>
        <h1>{access.agency.display_name}</h1>
        <p>
          Account {access.agency.account_number} · Authorized buyer{" "}
          {access.profile.full_name}
        </p>
      </section>

      <section className={styles.grid}>
        <article className={`${styles.card} ${styles.cardWide}`}>
          <h2>Agency terms and limits</h2>
          <p className={styles.note}>
            This information is read-only. Contact administration to request changes.
          </p>
          <dl className={styles.details}>
            <div>
              <dt>Agency account</dt>
              <dd>{access.agency.account_number}</dd>
            </div>
            <div>
              <dt>Legal name</dt>
              <dd>{access.agency.legal_name}</dd>
            </div>
            <div>
              <dt>Display name</dt>
              <dd>{access.agency.display_name}</dd>
            </div>
            <div>
              <dt>Negotiated discount</dt>
              <dd>{percentage(access.agency.discount_basis_points)}</dd>
            </div>
            <div>
              <dt>Payment date limit</dt>
              <dd>Net {access.agency.payment_terms_days} days</dd>
            </div>
            <div>
              <dt>Approved credit limit</dt>
              <dd>{currency.format(credit.approvedCreditLimitCents / 100)}</dd>
            </div>
            <div>
              <dt>Available credit</dt>
              <dd>{currency.format(credit.availableCreditCents / 100)}</dd>
            </div>
            <div>
              <dt>Purchase order required</dt>
              <dd>{access.agency.po_required ? "Yes" : "No"}</dd>
            </div>
          </dl>
          <a className={styles.secondaryButton} href={termsRequestHref}>
            Request new negotiated terms from admin
          </a>
        </article>

        <article className={`${styles.card} ${styles.cardFeatured}`}>
          <h2>Build a campaign</h2>
          <dl className={styles.details}>
            <div>
              <dt>Negotiated discount</dt>
              <dd>
                {percentage(access.agency.discount_basis_points)}
              </dd>
            </div>
            <div>
              <dt>Payment terms</dt>
              <dd>Net {access.agency.payment_terms_days}</dd>
            </div>
            <div>
              <dt>PO required</dt>
              <dd>{access.agency.po_required ? "Yes" : "No"}</dd>
            </div>
          </dl>
          <Link className={styles.primaryButton} href="/order">
            Place agency order
          </Link>
        </article>

        <article className={`${styles.card} ${styles.creditCard}`}>
          <h2>Available credit</h2>
          <dl className={styles.details}>
            <div>
              <dt>Approved limit</dt>
              <dd>
                {currency.format(
                  credit.approvedCreditLimitCents / 100,
                )}
              </dd>
            </div>
            <div>
              <dt>Current exposure</dt>
              <dd>
                {currency.format(credit.currentExposureCents / 100)}
              </dd>
            </div>
            <div>
              <dt>Available credit</dt>
              <dd>
                {currency.format(credit.availableCreditCents / 100)}
              </dd>
            </div>
          </dl>
          <Link
            className={styles.secondaryButton}
            href="/portal/orders"
          >
            View orders and POs
          </Link>
        </article>

        <article className={styles.card}>
          <h2>Invoices</h2>
          <p className={styles.note}>
            Review invoices, secure bank remittance instructions,
            due dates, balances, and downloadable PDFs.
          </p>
          <Link
            className={styles.secondaryButton}
            href="/portal/invoices"
          >
            Open invoice center
          </Link>
        </article>

        <article className={styles.card}>
          <h2>Account security</h2>
          <p className={styles.note}>
            Purchasing requires an active agency membership and a
            verified authenticator session.
          </p>
          <Link
            className={styles.secondaryButton}
            href="/auth/mfa/challenge?next=/portal"
          >
            Verify security
          </Link>
        </article>
      </section>
    </main>
  );
}
