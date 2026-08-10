import { createHash } from "node:crypto";

import { getCommerceServerConfig } from "@/lib/server/config";
import {
  type RequestSecurityContext,
} from "@/lib/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SecurityEventSeverity = "info" | "warning" | "critical";

export interface RateLimitOptions {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
  context: RequestSecurityContext;
  actorUserId?: string;
  actorEmail?: string;
  failClosed?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
  currentHits: number;
}

export class RateLimitExceededError extends Error {
  retryAfterSeconds: number;
  scope: string;

  constructor(scope: string, retryAfterSeconds: number) {
    super("Too many requests. Try again later.");
    this.name = "RateLimitExceededError";
    this.scope = scope;
    this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
  }
}

function hashValue(value: string): string {
  const config = getCommerceServerConfig();

  return createHash("sha256")
    .update(`${config.securityHashSalt}:${value}`)
    .digest("hex");
}

export function hashRequestIp(ipAddress: string): string {
  return hashValue(`ip:${ipAddress || "unknown"}`);
}

export async function recordSecurityEvent(input: {
  eventKey: string;
  severity?: SecurityEventSeverity;
  context: RequestSecurityContext;
  actorUserId?: string;
  actorEmail?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();

    const { error } = await admin.rpc("record_security_event", {
      p_event_key: input.eventKey,
      p_severity: input.severity ?? "info",
      p_actor_user_id: input.actorUserId ?? null,
      p_actor_email: input.actorEmail ?? null,
      p_route: input.context.route,
      p_request_method: input.context.method,
      p_request_ip_hash: hashRequestIp(input.context.ipAddress),
      p_user_agent: input.context.userAgent,
      p_request_id: input.context.requestId,
      p_metadata: input.metadata ?? {},
    });

    if (error) {
      console.error("Security-event logging failed", error);
    }
  } catch (error) {
    console.error("Security-event logging failed", error);
  }
}

export async function enforceRateLimit(
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const keyHash = hashValue(
    `${options.scope}:${options.identifier.trim().toLowerCase()}`,
  );
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_key_hash: keyHash,
    p_scope: options.scope,
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds,
  });

  if (error) {
    console.error("Rate-limit check failed", error);

    if (options.failClosed) {
      throw new Error("Security controls are temporarily unavailable.");
    }

    return {
      allowed: true,
      remaining: options.limit,
      resetAt: new Date(
        Date.now() + options.windowSeconds * 1000,
      ).toISOString(),
      currentHits: 0,
    };
  }

  const result = (Array.isArray(data) ? data[0] : data) as
    | {
        allowed: boolean;
        remaining: number | string;
        reset_at: string;
        current_hits: number | string;
      }
    | undefined;

  if (!result) {
    throw new Error("Rate-limit response was invalid.");
  }

  const parsed: RateLimitResult = {
    allowed: Boolean(result.allowed),
    remaining: Number(result.remaining),
    resetAt: String(result.reset_at),
    currentHits: Number(result.current_hits),
  };

  if (!parsed.allowed) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (new Date(parsed.resetAt).getTime() - Date.now()) / 1000,
      ),
    );

    await recordSecurityEvent({
      eventKey: "security.rate_limit_blocked",
      severity: "warning",
      context: options.context,
      actorUserId: options.actorUserId,
      actorEmail: options.actorEmail,
      metadata: {
        scope: options.scope,
        currentHits: parsed.currentHits,
        limit: options.limit,
        retryAfterSeconds,
      },
    });

    throw new RateLimitExceededError(
      options.scope,
      retryAfterSeconds,
    );
  }

  return parsed;
}

export interface Stage6SecurityReport {
  generatedAt: string;
  rlsMissing: string[];
  anonGrants: Array<{ table: string; privilege: string }>;
  publicBuckets: string[];
  activeStaffWithoutVerifiedMfa: number;
  activeBuyersWithoutVerifiedMfa: number;
  expiredPendingInvites: number;
  deadLetterNotifications: number;
  failedReleaseQueueItems: number;
  requiredLaunchChecksOpen: number;
  activeRemittanceAccounts: number;
  overdueInvoices: number;
}

export async function getStage6SecurityReport(): Promise<Stage6SecurityReport> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc(
    "get_stage_6_security_report",
  );

  if (error) {
    throw new Error(error.message);
  }

  return data as Stage6SecurityReport;
}
