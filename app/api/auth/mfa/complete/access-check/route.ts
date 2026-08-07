import { NextResponse } from "next/server";

import { getVerifiedIdentity } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const identity = await getVerifiedIdentity();

  if (!identity) {
    return NextResponse.json(
      {
        authenticated: false,
        message: "No authenticated Supabase session was found.",
      },
      { status: 401 },
    );
  }

  const admin = createSupabaseAdminClient();

  const [
    { data: profile, error: profileError },
    { data: staff, error: staffError },
  ] = await Promise.all([
    admin
      .from("user_profiles")
      .select(
        "user_id,username,email,full_name,status,mfa_required,mfa_enrolled_at",
      )
      .eq("user_id", identity.userId)
      .maybeSingle(),

    admin
      .from("staff_members")
      .select("user_id,role,active")
      .eq("user_id", identity.userId)
      .maybeSingle(),
  ]);

  const authorized =
    identity.currentLevel === "aal2" &&
    profile?.status === "active" &&
    staff?.active === true &&
    (staff?.role === "system_admin" || staff?.role === "finance");

  return NextResponse.json({
    authenticated: true,
    authorized,
    session: {
      userId: identity.userId,
      email: identity.email,
      currentLevel: identity.currentLevel,
      nextLevel: identity.nextLevel,
    },
    profile: profile ?? null,
    staff: staff ?? null,
    errors: {
      profile: profileError?.message ?? null,
      staff: staffError?.message ?? null,
    },
  });
}