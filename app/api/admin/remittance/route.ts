import { NextRequest, NextResponse } from "next/server";

import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStaffAccessForApi([
      "finance",
      "system_admin",
    ]);
    const body = (await request.json()) as Record<string, unknown>;

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc(
      "create_remittance_account",
      {
        p_display_name: String(body.displayName ?? ""),
        p_bank_name: String(body.bankName ?? ""),
        p_beneficiary_name: String(body.beneficiaryName ?? ""),
        p_account_type: String(body.accountType ?? ""),
        p_routing_number: String(body.routingNumber ?? "").replace(
          /\D/g,
          "",
        ),
        p_account_number: String(body.accountNumber ?? "").replace(
          /\D/g,
          "",
        ),
        p_remittance_email: String(body.remittanceEmail ?? ""),
        p_ach_enabled: body.achEnabled !== false,
        p_wire_enabled: body.wireEnabled !== false,
        p_instructions: String(body.instructions ?? ""),
        p_actor_user_id: staff.identity.userId,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      {
        ok: true,
        remittanceAccountId: data,
      },
      { status: 201 },
    );
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
            : "Remittance account could not be saved.",
      },
      { status: 400 },
    );
  }
}
