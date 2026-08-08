import Link from "next/link";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1>La Grandiosa</h1>
        <p>Agency commerce for premium mall media campaigns.</p>
        <div className={styles.actions}>
          <Link className={styles.primaryButton} href="/auth/login">
            Agency login
          </Link>
          <Link className={styles.secondaryButton} href="/portal">
            Agency portal
          </Link>
        </div>
      </section>
    </main>
  );
}
