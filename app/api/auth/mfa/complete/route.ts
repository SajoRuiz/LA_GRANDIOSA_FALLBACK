import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } =
    await supabase.auth.getUser();
  const userId = userData.user?.id?.trim();

  if (userError || !userId) {
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 },
    );
  }

  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalError || aal?.currentLevel !== "aal2") {
    return NextResponse.json(
      { error: "AAL2 authenticator verification is required." },
      { status: 403 },
    );
  }

  const { error } = await supabase.rpc("mark_current_user_mfa_enrolled");

  if (error) {
    return NextResponse.json(
      { error: "The MFA status could not be recorded." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, aal: "aal2" });
}
