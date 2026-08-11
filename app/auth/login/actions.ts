"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sanitizeNextPath, withNext } from "@/lib/auth/paths";
import { getServerActionRequestContext } from "@/lib/server/request-context";
import {
  enforceRateLimit,
  RateLimitExceededError,
  recordSecurityEvent,
} from "@/lib/server/security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function loginError(nextPath: string, message?: string): never {
  redirect(
    `/auth/login?error=${encodeURIComponent(
      message ||
        "The username/email or password is incorrect.",
    )}&next=${encodeURIComponent(nextPath)}`,
  );
}

async function resolveEmail(
  identifier: string,
): Promise<string | null> {
  const normalized = identifier.trim().toLowerCase();

  if (normalized.includes("@")) {
    return normalized;
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select("email,status")
    .eq("username", normalized)
    .maybeSingle();

  if (!data || data.status !== "active") {
    return null;
  }

  return String(data.email).toLowerCase();
}

export async function loginAction(formData: FormData) {
  const nextPath = sanitizeNextPath(
    String(formData.get("next") ?? "/portal"),
    "/portal",
  );
  const identifier = String(
    formData.get("identifier") ?? "",
  ).trim();
  const password = String(formData.get("password") ?? "");
  const context = getServerActionRequestContext(
    "/auth/login",
    "POST",
  );

  if (!identifier || !password) {
    loginError(nextPath);
  }

  try {
    await enforceRateLimit({
      scope: "auth_login_ip",
      identifier: context.ipAddress,
      limit: 25,
      windowSeconds: 15 * 60,
      context,
      failClosed: process.env.NODE_ENV === "production",
    });

    await enforceRateLimit({
      scope: "auth_login_identifier",
      identifier: `${context.ipAddress}:${identifier}`,
      limit: 8,
      windowSeconds: 15 * 60,
      context,
      failClosed: process.env.NODE_ENV === "production",
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      loginError(
        nextPath,
        `Too many sign-in attempts. Try again in approximately ${Math.ceil(
          error.retryAfterSeconds / 60,
        )} minute(s).`,
      );
    }

    loginError(
      nextPath,
      "Secure sign-in is temporarily unavailable. Try again shortly.",
    );
  }

  const email = await resolveEmail(identifier);

  if (!email) {
    await recordSecurityEvent({
      eventKey: "auth.login_failed",
      severity: "warning",
      context,
      metadata: { reason: "identifier_not_resolved" },
    });
    loginError(nextPath);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error || !data.user) {
    await recordSecurityEvent({
      eventKey: "auth.login_failed",
      severity: "warning",
      context,
      actorEmail: email,
      metadata: {
        reason: "invalid_credentials",
        providerCode: error?.code ?? null,
      },
    });
    loginError(nextPath);
  }

  revalidatePath("/", "layout");

  await recordSecurityEvent({
    eventKey: "auth.login_succeeded",
    severity: "info",
    context,
    actorUserId: data.user.id,
    actorEmail: email,
  });

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("status")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (profileError) {
    await recordSecurityEvent({
      eventKey: "auth.profile_query_failed",
      severity: "critical",
      context,
      actorUserId: data.user.id,
      actorEmail: email,
      metadata: { message: profileError.message },
    });

    if (process.env.NODE_ENV === "production") {
      await supabase.auth.signOut({ scope: "local" });
    }

    redirect(
      `/auth/access-denied?reason=${encodeURIComponent(
        "profile-query-error",
      )}`,
    );
  }

  if (!profile) {
    const { data: invite } = await admin
      .from("agency_invites")
      .select("id,status")
      .eq("auth_user_id", data.user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (invite) {
      redirect("/auth/activate");
    }

    if (process.env.NODE_ENV === "production") {
      await supabase.auth.signOut({ scope: "local" });
    }

    redirect("/auth/access-denied?reason=profile-missing");
  }

  if (profile.status !== "active") {
    if (process.env.NODE_ENV === "production") {
      await supabase.auth.signOut({ scope: "local" });
    }

    redirect(
      `/auth/access-denied?reason=${encodeURIComponent(
        `account-${profile.status}`,
      )}`,
    );
  }

  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalError) {
    await recordSecurityEvent({
      eventKey: "auth.mfa_level_failed",
      severity: "warning",
      context,
      actorUserId: data.user.id,
      actorEmail: email,
      metadata: { message: aalError.message },
    });

    redirect(
      `/auth/access-denied?reason=${encodeURIComponent(
        "mfa-level-error",
      )}`,
    );
  }

  if (aal?.currentLevel === "aal2") {
    redirect(nextPath);
  }

  if (aal?.nextLevel === "aal2") {
    redirect(withNext("/auth/mfa/challenge", nextPath));
  }

  redirect(withNext("/auth/mfa/enroll", nextPath));
}
