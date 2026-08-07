import Link from "next/link";
import { requireAgencyPurchaseAccess } from "@/lib/auth/access";
import styles from "./received.module.css";

type ReceivedSearchParams = {
  order?: string | string[];
  credit?: string | string[];
  available?: string | string[];
  shortfall?: string | string[];
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ClientInformationReceivedPage({
  searchParams,
}: {
  searchParams: ReceivedSearchParams;
}) {
  const access = await requireAgencyPurchaseAccess("/checkout/received");
  const params = searchParams;
  const orderNumber = firstValue(params.order);
  const creditStatus = firstValue(params.credit);
  const availableCredit = Number(firstValue(params.available) || 0);
  const shortfall = Number(firstValue(params.shortfall) || 0);
  const reviewRequired = creditStatus === "review_required";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/portal">
          <img
            className={styles.logo}
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
        </Link>
      </header>

      <section className={styles.card}>
        <p className={styles.eyebrow}>AGENCY ORDER RECEIVED</p>
        <h1>
          {reviewRequired
            ? "Credit review is required."
            : "Your agency credit hold is active."}
        </h1>

        {orderNumber ? (
          <p className={styles.orderNumber}>
            Order number: <strong>{orderNumber}</strong>
          </p>
        ) : null}

        <p>
          The order is linked to {access.agency.display_name} and purchaser{" "}
          {access.profile.full_name}. Negotiated pricing was applied from the
          approved agency account.
        </p>

        <aside className={styles.notice}>
          {reviewRequired ? (
            <>
              The requested contract exceeds currently available credit by{" "}
              <strong>{currency.format(shortfall / 100)}</strong>. The request
              has been sent to processing@lagrandiosapr.com for a manual credit
              exception decision. No purchase order or invoice has been issued
              yet.
            </>
          ) : (
            <>
              The contract is within the approved credit limit. Projected
              available credit after this hold is{" "}
              <strong>{currency.format(availableCredit / 100)}</strong>. The
              purchase-order upload and invoice workflow opens in Stage 3B-C.
            </>
          )}
        </aside>

        <div className={styles.actions}>
          <Link className={styles.primaryButton} href="/portal">
            Return to agency portal
          </Link>
          <Link className={styles.secondaryButton} href="/order">
            Start another order
          </Link>
        </div>
      </section>
    </main>
  );
}
