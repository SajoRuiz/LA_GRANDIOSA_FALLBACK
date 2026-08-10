"use server";

import { redirect } from "next/navigation";
import { hashActivationCode } from "@/lib/server/activation-code";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function activationError(message: string): never {
  redirect(`/auth/activate?error=${encodeURIComponent(message)}`);
}

async function queueInviteAcceptedProcessingEmail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
  requesterName: string,
  agencyName?: string,
) {
  try {
    const config = getCommerceServerConfig();
    const normalizedEmail = email.trim().toLowerCase();
    const dedupeKey = `access-request-processing-${normalizedEmail}-${crypto.randomUUID()}`;

    await admin.from("notification_outbox").insert({
      channel: "email",
      template_key: "internal_access_request_processing",
      recipient: config.internalProcessingEmail,
      sender_email: config.transactionalFromEmail,
      reply_to_email: config.salesReplyToEmail,
      dedupe_key: dedupeKey,
      priority: 10,
      payload: {
        requesterName: requesterName || normalizedEmail,
        requesterEmail: normalizedEmail,
        company: agencyName || "",
        message:
          "The invited agency user has completed account activation and is ready for onboarding review.",
        portalUrl: `${config.appBaseUrl}/admin/leads`,
      },
    });
  } catch (notificationError) {
    console.error("Failed to queue invite-accepted processing email.", notificationError);
  }
}

export async function activateAgencyAccount(formData: FormData) {
  const inviteId = String(formData.get("inviteId") ?? "").trim();
  const activationCode = String(formData.get("activationCode") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!inviteId || !activationCode || !username || !fullName || !password) {
    activationError("Complete every required activation field.");
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/.test(username)) {
    activationError(
      "Username must contain 3–40 letters, numbers, periods, underscores, or hyphens.",
    );
  }

  if (password.length < 12) {
    activationError("Password must contain at least 12 characters.");
  }

  if (password !== confirmPassword) {
    activationError("The password confirmation does not match.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as { sub?: string; email?: string } | undefined;

  if (claimsError || !claims?.sub) {
    redirect("/auth/login?error=" + encodeURIComponent("Sign in through the invitation link first."));
  }

  const admin = createSupabaseAdminClient();
  const { data: existingUsername } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("username", username)
    .neq("user_id", claims.sub)
    .maybeSingle();

  if (existingUsername) {
    activationError("That username is already in use.");
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password,
    data: {
      username,
      full_name: fullName,
    },
  });

  if (passwordError) {
    activationError(passwordError.message);
  }

  const { data, error } = await supabase.rpc("activate_agency_invite", {
    p_invite_id: inviteId,
    p_username: username,
    p_full_name: fullName,
    p_telephone: telephone,
    p_invite_code_hash: hashActivationCode(activationCode),
  });

  if (error) {
    activationError(error.message);
  }

  const activated = Array.isArray(data) ? data[0] : data;

  if (!activated?.agency_id) {
    activationError("The agency account could not be activated.");
  }

  await admin.auth.admin.updateUserById(claims.sub, {
    app_metadata: {
      agency_id: activated.agency_id,
      agency_role: activated.agency_role,
    },
  });

  await Promise.all([
    admin
      .from("access_leads")
      .update({ status: "contacted" })
      .eq("requester_email", String(claims.email ?? "").trim().toLowerCase()),
    queueInviteAcceptedProcessingEmail(
      admin,
      String(claims.email ?? "").trim(),
      fullName || username,
      activated?.agency_id ? undefined : undefined,
    ),
  ]);

  redirect("/auth/mfa/enroll?next=/portal");
}
