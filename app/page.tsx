import Link from "next/link";
import styles from "./page.module.css";

export default function HomePage() {
  const orderPath = "/order";

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.badge}>LA GRANDIOSA · AGENCY COMMERCE</p>
        <h1>Book your mall-screen campaign in one contract.</h1>
        <p className={styles.lead}>
          Reserved for approved agencies with secure login and MFA. Build a campaign,
          add combinations to one contract, and continue to client information and PO flow.
        </p>

        <div className={styles.actions}>
          <Link className={styles.primaryButton} href={orderPath}>
            PLACE ORDER
          </Link>
          <Link className={styles.secondaryButton} href="mailto:ventas@lagrandiosapr.com">
            Contact ventas@lagrandiosapr.com
          </Link>
        </div>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2>How it works</h2>
          <p className={styles.flow}>PLACE ORDER → /order → Add to contract → /cart</p>
          <p>
            Choose date ranges and screen combinations, then review totals before checkout.
          </p>
        </article>

        <article className={styles.card}>
          <h2>Protected agency workflow</h2>
          <p>
            Invite-only access, agency-level pricing, approved credit controls, purchase-order
            management, invoice center, and asset submission tracking.
          </p>
        </article>

        <article className={styles.card}>
          <h2>Start now</h2>
          <p>
            If your agency already has credentials, continue directly to ordering.
          </p>
          <Link className={styles.inlineButton} href={orderPath}>
            PLACE ORDER
          </Link>
        </article>
      </section>
    </main>
  );
}
