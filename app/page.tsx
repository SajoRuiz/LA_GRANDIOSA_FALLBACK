import Link from "next/link";
import styles from "./page.module.css";

export default function HomePage() {
  const orderPath = "/order";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="La Grandiosa home">
          <img className={styles.logo} src="/la-grandiosa-logo.png" alt="La Grandiosa" />
        </Link>
        <nav className={styles.headerActions} aria-label="Homepage actions">
          <Link href="/auth/login">Agency login</Link>
          <Link href="/portal">Agency portal</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>La Grandiosa Private Portal</p>
          <h1>Agency commerce built for approved teams.</h1>
          <p className={styles.lead}>
            The same brand system used across the private portal now frames the public
            entry point: deep navy, electric blue highlights, and premium orange calls to
            action.
          </p>

          <div className={styles.actions}>
            <Link className={styles.primaryButton} href={orderPath}>
              PLACE ORDER
            </Link>
            <Link className={styles.secondaryButton} href="/portal">
              Agency portal
            </Link>
          </div>
        </div>

        <aside className={styles.heroPanel} aria-label="Private portal brand preview">
          <p className={styles.panelEyebrow}>Protected workflow</p>
          <h2>Invite-only access. Agency pricing. Credit controls.</h2>
          <p>
            Built around the same operational theme as the private portal so the home
            experience feels like part of the same product family.
          </p>
          <ul className={styles.featureList}>
            <li>Secure login and TOTP MFA</li>
            <li>Purchase-order and invoice flow</li>
            <li>Asset submission tracking</li>
          </ul>
        </aside>
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
          <h2>Private portal theme</h2>
          <p>
            Deep navy panels, electric blue accents, orange action buttons, and the La
            Grandiosa hero image unify the experience with the internal portal.
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

      <footer className={styles.footer}>
        <span>La Grandiosa · The Mall of San Juan</span>
        <Link href="mailto:ventas@lagrandiosapr.com">ventas@lagrandiosapr.com</Link>
      </footer>
    </main>
  );
}
