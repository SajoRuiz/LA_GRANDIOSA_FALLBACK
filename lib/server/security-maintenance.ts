import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface SecurityMaintenanceResult {
  purgedRateLimitBuckets: number;
  expiredAgencyInvites: number;
}

export async function runSecurityMaintenance(): Promise<SecurityMaintenanceResult> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const [{ data: purged, error: purgeError }, inviteResult] =
    await Promise.all([
      admin.rpc("purge_expired_rate_limits"),
      admin
        .from("agency_invites")
        .update({
          status: "expired",
          updated_at: now,
        })
        .eq("status", "pending")
        .lt("expires_at", now)
        .select("id"),
    ]);

  if (purgeError) {
    throw new Error(purgeError.message);
  }

  if (inviteResult.error) {
    throw new Error(inviteResult.error.message);
  }

  return {
    purgedRateLimitBuckets: Number(purged ?? 0),
    expiredAgencyInvites: inviteResult.data?.length ?? 0,
  };
}
