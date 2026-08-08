import Link from "next/link";
import { requireStaffAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import DeadlineAdminClient, {
  type DeadlineOrder,
} from "./DeadlineAdminClient";
import styles from "./deadlines.module.css";

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function AssetDeadlineAdminPage() {
  await requireStaffAccess("/admin/deadlines", [
    "sales_reviewer",
    "finance",
    "system_admin",
  ]);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select(
      "id,order_number,status,asset_due_at,asset_due_note,agency_accounts(display_name,account_number),order_items(start_date,end_date)",
    )
    .in("status", [
      "awaiting_assets",
      "assets_received",
      "revision_requested",
      "under_review",
    ])
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const orders: DeadlineOrder[] = (data ?? []).map((order) => {
    const agency = relationOne(order.agency_accounts);
    const items = Array.isArray(order.order_items)
      ? order.order_items
      : [];
    const starts = items
      .map((item) => String(item.start_date ?? ""))
      .filter(Boolean)
      .sort();
    const ends = items
      .map((item) => String(item.end_date ?? ""))
      .filter(Boolean)
      .sort();

    return {
      id: String(order.id),
      orderNumber: String(order.order_number),
      agencyName: String(agency?.display_name ?? ""),
      accountNumber: String(agency?.account_number ?? ""),
      status: String(order.status),
      campaignStart: starts[0] ?? "",
      campaignEnd: ends.at(-1) ?? "",
      assetDueAt: String(order.asset_due_at ?? ""),
      assetDueNote: String(order.asset_due_note ?? ""),
    };
  });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin/assets">
          <img
            className={styles.logo}
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
        </Link>
        <nav>
          <Link href="/admin/assets">Asset reviews</Link>
          <Link href="/admin/notifications">Notifications</Link>
          <Link href="/admin/releases">Releases</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <p>CAMPAIGN OPERATIONS</p>
        <h1>Asset deadlines.</h1>
        <p>
          Set the final creative-delivery date for each order. Customer email
          and SMS reminders are generated from this deadline.
        </p>
      </section>

      <DeadlineAdminClient orders={orders} />
    </main>
  );
}
