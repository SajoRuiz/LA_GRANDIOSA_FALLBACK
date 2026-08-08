import { NextRequest, NextResponse } from "next/server";
import { getVerifiedIdentity, getStaffAccess } from "@/lib/auth/access";
import { getCommerceServerConfig } from "@/lib/server/config";
import { processNotificationOutbox } from "@/lib/server/notification-delivery";

export const runtime = "nodejs";
export const maxDuration = 60;

async function authorized(request: NextRequest): Promise<boolean> {
  const config = getCommerceServerConfig();
  const header = request.headers.get("authorization") ?? "";
  if (config.notificationCronSecret && header === `Bearer ${config.notificationCronSecret}`) return true;
  const identity = await getVerifiedIdentity();
  if (!identity || identity.currentLevel !== "aal2") return false;
  const staff = await getStaffAccess();
  return Boolean(staff?.staff.active && ['system_admin','finance'].includes(staff.staff.role));
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Notification-worker authorization required." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const limit = Math.max(1, Math.min(Number(body.limit ?? 20), 100));
  try { return NextResponse.json({ ok: true, ...(await processNotificationOutbox(limit)) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Notification processing failed." }, { status: 500 }); }
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Notification-worker authorization required." }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...(await processNotificationOutbox(20)) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Notification processing failed." }, { status: 500 }); }
}
