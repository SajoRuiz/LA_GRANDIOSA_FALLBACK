import type { Metadata } from "next";
import Link from "next/link";
import CartClient from "./CartClient";
import styles from "./cart.module.css";

export const metadata: Metadata = {
  title: "Contract Cart | La Grandiosa",
  description:
    "Review multiple La Grandiosa advertising combinations in one contract.",
};

export default function CartPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="Return to La Grandiosa home">
          <img
            className={styles.logo}
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
        </Link>

        <Link className={styles.addLink} href="/order">
          Add combination
        </Link>
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>SHOPPING CART · CONTRACT PREVIEW</p>
        <h1>Review your campaign contract.</h1>
        <p>
          Multiple advertising combinations may be included in the same
          contract. Each line is priced from Tarifa Mensual using its inclusive
          date range plus the 10% date-selection premium.
        </p>
      </section>

      <CartClient />
    </main>
  );
}
