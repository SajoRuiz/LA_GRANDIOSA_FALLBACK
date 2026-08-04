import type { Metadata } from "next";
import Link from "next/link";
import CartClient from "./CartClient";
import styles from "./cart.module.css";

export const metadata: Metadata = {
  title: "Contract Cart | La Grandiosa",
  description:
    "Review multiple full-day La Grandiosa advertising combinations in one contract.",
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
          Every line includes full-day screen service. Short buys use daily
          proration and the exact-date premium, monthly buys use Tarifa
          Mensual, and qualifying full multi-month buys receive a 10%
          discount.
        </p>
      </section>

      <CartClient />
    </main>
  );
}
