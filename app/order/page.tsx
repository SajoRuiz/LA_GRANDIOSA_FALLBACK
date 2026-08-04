import type { Metadata } from "next";
import Link from "next/link";
import BookingConfigurator from "./BookingConfigurator";
import styles from "./order.module.css";

export const metadata: Metadata = {
  title: "Place Order | La Grandiosa",
  description:
    "Select campaign dates and add La Grandiosa advertising combinations to one contract.",
};

export default function OrderPage() {
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

        <div className={styles.headerActions}>
          <Link className={styles.backLink} href="/">
            Back to website
          </Link>
          <Link className={styles.cartLink} href="/cart">
            View contract
          </Link>
        </div>
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>PLACE YOUR ORDER</p>
        <h1>Build your campaign.</h1>
        <p>
          Select the inclusive campaign dates, configure an advertising
          combination, and add it to a contract. You may add multiple
          combinations before checkout.
        </p>
      </section>

      <BookingConfigurator />
    </main>
  );
}
