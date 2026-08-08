import type { Metadata } from "next";
import Link from "next/link";

import { requireAgencyPurchaseAccess } from "@/lib/auth/access";

import ClientInformationForm from "./ClientInformationForm";
import styles from "./client.module.css";

export const metadata: Metadata = {
  title: "Client Information | La Grandiosa",
  description:
    "Capture mandatory client contact and address details before agency purchase-order submission.",
};

export default async function ClientInformationPage() {
  await requireAgencyPurchaseAccess("/checkout/client");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/cart" aria-label="Return to contract cart">
          <img
            className={styles.logo}
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
        </Link>
        <Link className={styles.backLink} href="/cart">
          Back to contract cart
        </Link>
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>CLIENT INFORMATION</p>
        <h1>Provide contract contact and billing details.</h1>
        <p>
          This information is saved with the agency order and used for
          purchase-order and invoicing workflows.
        </p>
      </section>

      <ClientInformationForm />
    </main>
  );
}
