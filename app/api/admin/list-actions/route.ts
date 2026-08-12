import { NextRequest, NextResponse } from "next/server";

import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type EntityAction =
  | "delete"
  | "suspend"
  | "decline"
  | "void"
  | "deactivate"
  | "clear"
  | "fail"
  | "waive";

function parseIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

async function voidInvoices(ids: string[], actorUserId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("invoices")
    .select("id,order_id,invoice_number,status,paid_cents,balance_cents")
    .in("id", ids);

  if (error) {
    throw new Error(error.message);
  }

  for (const invoice of data ?? []) {
    if (["void", "written_off", "paid"].includes(invoice.status)) {
      continue;
    }

    if (Number(invoice.paid_cents ?? 0) > 0) {
      throw new Error(
        `Invoice ${invoice.invoice_number} already has recorded payments and cannot be voided here.`,
      );
    }

    const { error: updateError } = await admin
      .from("invoices")
      .update({
        status: "void",
        balance_cents: 0,
      })
      .eq("id", invoice.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: historyError } = await admin
      .from("invoice_status_history")
      .insert({
        invoice_id: invoice.id,
        previous_status: invoice.status,
        new_status: "void",
        actor_user_id: actorUserId,
        note: "Voided from invoice administration list.",
        metadata: {
          source: "admin_list_actions",
        },
      });

    if (historyError) {
      throw new Error(historyError.message);
    }

    const { error: auditError } = await admin
      .from("audit_log")
      .insert({
        order_id: invoice.order_id,
        actor_user_id: actorUserId,
        event_key: "invoice.void",
        entity_type: "invoice",
        entity_id: invoice.id,
        metadata: {
          invoiceNumber: invoice.invoice_number,
          source: "admin_list_actions",
        },
      });

    if (auditError) {
      throw new Error(auditError.message);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const entity = String(body.entity ?? "").trim();
    const action = String(body.action ?? "").trim() as EntityAction;
    const ids = parseIds(body.ids);

    if (!entity || !action || ids.length === 0) {
      throw new Error("Entity, action, and at least one item are required.");
    }

    const admin = createSupabaseAdminClient();

    switch (`${entity}:${action}`) {
      case "lead:delete": {
        await requireStaffAccessForApi([
          "sales_reviewer",
          "finance",
          "system_admin",
        ]);
        const { error } = await admin
          .from("access_leads")
          .delete()
          .in("id", ids);
        if (error) throw new Error(error.message);
        break;
      }

      case "agency:suspend": {
        await requireStaffAccessForApi(["finance", "system_admin"]);
        const { error } = await admin
          .from("agency_accounts")
          .update({ status: "suspended" })
          .in("id", ids)
          .neq("status", "closed");
        if (error) throw new Error(error.message);
        break;
      }

      case "creditReview:decline": {
        const staff = await requireStaffAccessForApi([
          "finance",
          "system_admin",
        ]);
        for (const id of ids) {
          const { error } = await admin.rpc(
            "resolve_agency_credit_review",
            {
              p_review_id: id,
              p_approve: false,
              p_reviewer_note: "Declined from credit administration list.",
              p_actor_user_id: staff.identity.userId,
            },
          );
          if (error) throw new Error(error.message);
        }
        break;
      }

      case "purchaseOrder:decline": {
        const staff = await requireStaffAccessForApi(["system_admin"]);
        for (const id of ids) {
          const { error } = await admin.rpc("review_purchase_order", {
            p_purchase_order_id: id,
            p_decision: "decline",
            p_reviewer_note: "Declined from purchase-order review list.",
            p_actor_user_id: staff.identity.userId,
          });
          if (error) throw new Error(error.message);
        }
        break;
      }

      case "invoice:void": {
        const staff = await requireStaffAccessForApi([
          "finance",
          "system_admin",
        ]);
        await voidInvoices(ids, staff.identity.userId);
        break;
      }

      case "remittance:deactivate": {
        await requireStaffAccessForApi(["finance", "system_admin"]);
        const { error } = await admin
          .from("remittance_accounts")
          .update({ active: false })
          .in("id", ids);
        if (error) throw new Error(error.message);
        break;
      }

      case "notification:delete": {
        await requireStaffAccessForApi(["finance", "system_admin"]);
        const { error } = await admin
          .from("notification_outbox")
          .delete()
          .in("id", ids);
        if (error) throw new Error(error.message);
        break;
      }

      case "deadline:clear": {
        const staff = await requireStaffAccessForApi([
          "sales_reviewer",
          "finance",
          "system_admin",
        ]);
        for (const id of ids) {
          const { error } = await admin.rpc("set_order_asset_deadline", {
            p_order_id: id,
            p_due_at: null,
            p_note: "",
            p_actor_user_id: staff.identity.userId,
          });
          if (error) throw new Error(error.message);
        }
        break;
      }

      case "release:fail": {
        const staff = await requireStaffAccessForApi([
          "sales_reviewer",
          "system_admin",
        ]);
        for (const id of ids) {
          const { error } = await admin.rpc("update_asset_release_status", {
            p_release_queue_id: id,
            p_action: "failed",
            p_external_reference: "",
            p_note: "Removed from release queue from the admin list.",
            p_actor_user_id: staff.identity.userId,
          });
          if (error) throw new Error(error.message);
        }
        break;
      }

      case "launchChecklist:waive": {
        const staff = await requireStaffAccessForApi(["system_admin"]);
        for (const id of ids) {
          const { error } = await admin.rpc(
            "update_launch_checklist_item",
            {
              p_item_id: id,
              p_status: "waived",
              p_evidence: "Waived from launch checklist list view.",
              p_actor_user_id: staff.identity.userId,
            },
          );
          if (error) throw new Error(error.message);
        }
        break;
      }

      default:
        throw new Error("This list action is not supported.");
    }

    return NextResponse.json({ ok: true, count: ids.length });
  } catch (error) {
    if (error instanceof AgencyAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Admin list action failed.",
      },
      { status: 400 },
    );
  }
}