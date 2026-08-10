import type { Metadata } from "next";
import Link from "next/link";
import { requireAgencyPurchaseAccess } from "@/lib/auth/access";
import { getAgencyCreditSummary } from "@/lib/server/agency-credit";
import CartClient from "./CartClient";
import styles from "./cart.module.css";

export const metadata: Metadata = {
  title: "Contract Cart | La Grandiosa",
  description:
    "Review multiple full-day La Grandiosa advertising combinations in one contract.",
};

export default async function CartPage() {
  const access = await requireAgencyPurchaseAccess("/cart");
  const credit = await getAgencyCreditSummary(access.agency.id);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/portal" aria-label="Return to agency portal">
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
          This protected contract preview belongs to {access.agency.display_name}. Sign in or request access to continue to client information and submit your order. The negotiated agency discount and approved-credit projection are shown before submission, and the server recalculates all amounts when the order record is created.
        </p>
      </section>

      <CartClient
        agency={{
          displayName: access.agency.display_name,
          accountNumber: access.agency.account_number,
          discountBasisPoints: access.agency.discount_basis_points,
          discountPolicy: access.agency.discount_policy,
          paymentTermsDays: access.agency.payment_terms_days,
        }}
        credit={credit}
      />
    </main>
  );
}
