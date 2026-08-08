import type { NextRequest } from "next/server";
import { getVerifiedIdentity, getStaffAccess } from "@/lib/auth/access";
import { getCommerceServerConfig } from "@/lib/server/config";

export async function automationRequestIsAuthorized(
  request: NextRequest,
): Promise<boolean> {
  const config = getCommerceServerConfig();
  const authorization = request.headers.get("authorization") ?? "";

  if (
    config.cronSecret &&
    authorization === `Bearer ${config.cronSecret}`
  ) {
    return true;
  }

  const identity = await getVerifiedIdentity();
  if (!identity || identity.currentLevel !== "aal2") {
    return false;
  }

  const staff = await getStaffAccess();
  return Boolean(
    staff?.staff.active &&
      ["system_admin", "finance"].includes(staff.staff.role),
  );
}
