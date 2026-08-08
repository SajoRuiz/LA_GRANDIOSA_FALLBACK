import Link from "next/link";

import { requireAgencyPurchaseAccess } from "@/lib/auth/access";

import styles from "./received.module.css";

type ReceivedSearchParams = {
  id?: string | string[];
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
  const access = await requireAgencyPurchaseAccess(
    "/checkout/received",
  );
  const orderId = firstValue(searchParams.id);
  const orderNumber = firstValue(searchParams.order);
  const creditStatus = firstValue(searchParams.credit);
  const availableCredit = Number(
    firstValue(searchParams.available) || 0,
  );
  const shortfall = Number(firstValue(searchParams.shortfall) || 0);
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
          The order is linked to {access.agency.display_name} and
          purchaser {access.profile.full_name}. Negotiated pricing was
          applied from the approved agency account.
        </p>

        <aside className={styles.notice}>
          {reviewRequired ? (
            <>
              The requested contract exceeds currently available
              credit by{" "}
              <strong>{currency.format(shortfall / 100)}</strong>.
              The finance team will review the exception. You may
              submit the purchase order while the credit review is
              pending, but it cannot be approved until credit is
              authorized.
            </>
          ) : (
            <>
              The contract is within the approved credit limit.
              Projected available credit after this hold is{" "}
              <strong>
                {currency.format(availableCredit / 100)}
              </strong>
              . Upload the agency purchase order to continue.
            </>
          )}
        </aside>

        <div className={styles.actions}>
          {orderId ? (
            <Link
              className={styles.primaryButton}
              href={`/portal/orders/${orderId}/purchase-order`}
            >
              Upload purchase order
            </Link>
          ) : null}
          <Link
            className={styles.secondaryButton}
            href="/portal/orders"
          >
            View agency orders
          </Link>
          <Link className={styles.secondaryButton} href="/order">
            Start another order
          </Link>
        </div>
      </section>
    </main>
  );
}
