import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface NotificationInsert {
  order_id: string | null;
  channel: "email" | "sms";
  template_key: string;
  recipient: string;
  sender_email: string;
  reply_to_email: string;
  payload: Record<string, unknown>;
  dedupe_key: string;
  category: string;
  priority: number;
}

function businessDate(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function utcDateValue(value: string): number {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysFromToday(today: string, target: string): number {
  return Math.round(
    (utcDateValue(target) - utcDateValue(today)) / 86_400_000,
  );
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function clientSnapshot(order: any): Record<string, unknown> {
  return (order?.client_snapshot ?? {}) as Record<string, unknown>;
}

function clientEmail(order: any): string {
  return String(clientSnapshot(order).email ?? "").trim().toLowerCase();
}

function clientPhone(order: any): string {
  const relation = relationOne<any>(order?.client_contacts);
  return String(
    relation?.telephone ?? clientSnapshot(order).telephone ?? "",
  ).trim();
}

function smsAllowed(order: any): boolean {
  const relation = relationOne<any>(order?.client_contacts);
  return Boolean(
    relation?.sms_transactional_consent ??
      clientSnapshot(order).sms_transactional_consent,
  );
}

function agencyName(order: any): string {
  const agency = relationOne<any>(order?.agency_accounts);
  return String(agency?.display_name ?? "");
}

function campaignRange(order: any): {
  startDate: string;
  endDate: string;
} | null {
  const items = Array.isArray(order?.order_items)
    ? order.order_items
    : [];
  if (!items.length) return null;

  const starts = items.map((item: any) => String(item.start_date)).sort();
  const ends = items.map((item: any) => String(item.end_date)).sort();
  return {
    startDate: starts[0],
    endDate: ends[ends.length - 1],
  };
}

function notification(
  base: Omit<NotificationInsert, "sender_email" | "reply_to_email">,
): NotificationInsert {
  const config = getCommerceServerConfig();
  return {
    ...base,
    sender_email: config.transactionalFromEmail,
    reply_to_email: config.salesReplyToEmail,
  };
}

function addCustomerChannels(
  target: NotificationInsert[],
  order: any,
  input: {
    templateKey: string;
    dedupeSuffix: string;
    payload: Record<string, unknown>;
    priority: number;
    category: string;
  },
) {
  const email = clientEmail(order);
  const phone = clientPhone(order);
  const orderId = String(order.id);

  if (email) {
    target.push(
      notification({
        order_id: orderId,
        channel: "email",
        template_key: input.templateKey,
        recipient: email,
        payload: input.payload,
        dedupe_key: `${input.dedupeSuffix}-email-${orderId}`,
        category: input.category,
        priority: input.priority,
      }),
    );
  }

  if (phone && smsAllowed(order)) {
    target.push(
      notification({
        order_id: orderId,
        channel: "sms",
        template_key: input.templateKey,
        recipient: phone,
        payload: input.payload,
        dedupe_key: `${input.dedupeSuffix}-sms-${orderId}`,
        category: input.category,
        priority: input.priority,
      }),
    );
  }
}

async function insertNotifications(rows: NotificationInsert[]) {
  if (!rows.length) return 0;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("notification_outbox")
    .upsert(rows, {
      onConflict: "dedupe_key",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function queueOperationalReminders() {
  const config = getCommerceServerConfig();
  const admin = createSupabaseAdminClient();
  const today = businessDate(config.businessTimeZone);
  const rows: NotificationInsert[] = [];

  const { data: assetOrders, error: assetError } = await admin
    .from("orders")
    .select(
      "id,order_number,status,asset_due_at,client_snapshot,client_contacts(telephone,sms_transactional_consent),agency_accounts(display_name),order_items(start_date,end_date)",
    )
    .in("status", [
      "awaiting_assets",
      "assets_received",
      "revision_requested",
    ]);

  if (assetError) throw new Error(assetError.message);

  for (const order of assetOrders ?? []) {
    const range = campaignRange(order);
    const orderNumber = String(order.order_number);
    const portalUrl = `${config.appBaseUrl}/portal/orders/${order.id}/assets`;

    if (!order.asset_due_at) {
      if (range) {
        const daysToStart = daysFromToday(today, range.startDate);
        if (daysToStart >= 0 && daysToStart <= 7) {
          rows.push(
            notification({
              order_id: String(order.id),
              channel: "email",
              template_key: "internal_asset_deadline_missing",
              recipient: config.internalProcessingEmail,
              payload: {
                orderNumber,
                agencyName: agencyName(order),
                campaignStartDate: range.startDate,
                daysUntilStart: daysToStart,
                portalUrl: `${config.appBaseUrl}/admin/deadlines`,
              },
              dedupe_key: `asset-deadline-missing-${order.id}-${range.startDate}`,
              category: "asset_deadline",
              priority: 20,
            }),
          );
        }
      }
      continue;
    }

    const dueDate = String(order.asset_due_at).slice(0, 10);
    const delta = daysFromToday(today, dueDate);

    if ([7, 3, 1, 0].includes(delta)) {
      addCustomerChannels(rows, order, {
        templateKey: "customer_asset_due_reminder",
        dedupeSuffix: `asset-due-${delta}-${dueDate}`,
        payload: {
          orderNumber,
          agencyName: agencyName(order),
          assetDueDate: dueDate,
          daysUntilDue: delta,
          assetPortalUrl: portalUrl,
        },
        priority: delta <= 1 ? 20 : 50,
        category: "asset_deadline",
      });
    }

    if ([-1, -3, -7].includes(delta)) {
      const daysOverdue = Math.abs(delta);
      addCustomerChannels(rows, order, {
        templateKey: "customer_assets_overdue",
        dedupeSuffix: `asset-overdue-${daysOverdue}-${dueDate}`,
        payload: {
          orderNumber,
          agencyName: agencyName(order),
          assetDueDate: dueDate,
          daysOverdue,
          assetPortalUrl: portalUrl,
        },
        priority: 10,
        category: "asset_deadline",
      });

      rows.push(
        notification({
          order_id: String(order.id),
          channel: "email",
          template_key: "internal_assets_overdue",
          recipient: config.internalProcessingEmail,
          payload: {
            orderNumber,
            agencyName: agencyName(order),
            assetDueDate: dueDate,
            daysOverdue,
            portalUrl: `${config.appBaseUrl}/admin/deadlines`,
          },
          dedupe_key: `internal-asset-overdue-${daysOverdue}-${order.id}-${dueDate}`,
          category: "asset_deadline",
          priority: 5,
        }),
      );
    }
  }

  const { data: invoices, error: invoiceError } = await admin
    .from("invoices")
    .select(
      "id,order_id,invoice_number,status,due_date,balance_cents,client_snapshot,agency_snapshot,orders(id,order_number,client_snapshot,client_contacts(telephone,sms_transactional_consent),agency_accounts(display_name))",
    )
    .in("status", ["issued", "partially_paid", "overdue"])
    .gt("balance_cents", 0);

  if (invoiceError) throw new Error(invoiceError.message);

  for (const invoice of invoices ?? []) {
    const order = relationOne<any>(invoice.orders) ?? {
      id: invoice.order_id,
      order_number: "",
      client_snapshot: invoice.client_snapshot,
      agency_accounts: invoice.agency_snapshot,
    };
    const delta = daysFromToday(today, String(invoice.due_date));
    const invoiceUrl = `${config.appBaseUrl}/portal/invoices/${invoice.id}`;
    const payload = {
      orderNumber: String(order.order_number ?? ""),
      agencyName:
        agencyName(order) ||
        String((invoice.agency_snapshot as any)?.displayName ?? ""),
      invoiceNumber: String(invoice.invoice_number),
      dueDate: String(invoice.due_date),
      balanceCents: Number(invoice.balance_cents),
      invoiceUrl,
    };

    if ([7, 3, 1, 0].includes(delta)) {
      addCustomerChannels(rows, order, {
        templateKey: "customer_invoice_due_reminder",
        dedupeSuffix: `invoice-due-${delta}-${invoice.id}-${invoice.due_date}`,
        payload: { ...payload, daysUntilDue: delta },
        priority: delta <= 1 ? 20 : 60,
        category: "invoice_reminder",
      });
    }

    if (delta < 0 && invoice.status !== "overdue") {
      await admin
        .from("invoices")
        .update({ status: "overdue" })
        .eq("id", invoice.id)
        .in("status", ["issued", "partially_paid"]);

      await admin.from("invoice_status_history").insert({
        invoice_id: invoice.id,
        previous_status: invoice.status,
        new_status: "overdue",
        note: "Automatically marked overdue by reminder automation.",
        metadata: { businessDate: today },
      });
    }

    if ([-1, -7, -15].includes(delta)) {
      const daysOverdue = Math.abs(delta);
      addCustomerChannels(rows, order, {
        templateKey: "customer_invoice_overdue",
        dedupeSuffix: `invoice-overdue-${daysOverdue}-${invoice.id}-${invoice.due_date}`,
        payload: { ...payload, daysOverdue },
        priority: 10,
        category: "invoice_reminder",
      });

      rows.push(
        notification({
          order_id: String(invoice.order_id),
          channel: "email",
          template_key: "internal_invoice_overdue",
          recipient: config.internalProcessingEmail,
          payload: {
            ...payload,
            daysOverdue,
            invoiceUrl: `${config.appBaseUrl}/admin/invoices`,
          },
          dedupe_key: `internal-invoice-overdue-${daysOverdue}-${invoice.id}-${invoice.due_date}`,
          category: "invoice_reminder",
          priority: 5,
        }),
      );
    }
  }

  const { data: campaigns, error: campaignError } = await admin
    .from("orders")
    .select(
      "id,order_number,status,client_snapshot,client_contacts(telephone,sms_transactional_consent),agency_accounts(display_name),order_items(start_date,end_date)",
    )
    .in("status", ["release_pending", "released", "live"]);

  if (campaignError) throw new Error(campaignError.message);

  for (const order of campaigns ?? []) {
    const range = campaignRange(order);
    if (!range) continue;
    const startDelta = daysFromToday(today, range.startDate);
    const endDelta = daysFromToday(today, range.endDate);
    const orderNumber = String(order.order_number);
    const portalUrl = `${config.appBaseUrl}/portal/orders`;

    if (startDelta === 1) {
      addCustomerChannels(rows, order, {
        templateKey: "customer_campaign_starting_tomorrow",
        dedupeSuffix: `campaign-start-tomorrow-${range.startDate}`,
        payload: {
          orderNumber,
          agencyName: agencyName(order),
          campaignStartDate: range.startDate,
          portalUrl,
        },
        priority: 20,
        category: "campaign",
      });

      if (order.status === "release_pending") {
        rows.push(
          notification({
            order_id: String(order.id),
            channel: "email",
            template_key: "internal_campaign_starting_unreleased",
            recipient: config.internalProcessingEmail,
            payload: {
              orderNumber,
              agencyName: agencyName(order),
              campaignStartDate: range.startDate,
              portalUrl: `${config.appBaseUrl}/admin/releases`,
            },
            dedupe_key: `campaign-unreleased-${order.id}-${range.startDate}`,
            category: "campaign",
            priority: 1,
          }),
        );
      }
    }

    if (endDelta === -1 && order.status === "live") {
      rows.push(
        notification({
          order_id: String(order.id),
          channel: "email",
          template_key: "internal_campaign_completion_review",
          recipient: config.internalProcessingEmail,
          payload: {
            orderNumber,
            agencyName: agencyName(order),
            campaignEndDate: range.endDate,
            portalUrl: `${config.appBaseUrl}/admin/releases`,
          },
          dedupe_key: `campaign-completion-review-${order.id}-${range.endDate}`,
          category: "campaign",
          priority: 30,
        }),
      );
    }
  }

  const inserted = await insertNotifications(rows);
  return {
    businessDate: today,
    prepared: rows.length,
    inserted,
  };
}
