import { headers } from "next/headers";
import type { NextRequest } from "next/server";

export interface RequestSecurityContext {
  ipAddress: string;
  userAgent: string;
  requestId: string;
  route: string;
  method: string;
}

function firstForwardedIp(value: string | null): string {
  return value?.split(",")[0]?.trim() || "";
}

export function getServerActionRequestContext(
  route: string,
  method = "POST",
): RequestSecurityContext {
  const requestHeaders = headers();

  return {
    ipAddress:
      firstForwardedIp(requestHeaders.get("x-forwarded-for")) ||
      requestHeaders.get("x-real-ip") ||
      "unknown",
    userAgent: requestHeaders.get("user-agent") || "",
    requestId:
      requestHeaders.get("x-request-id") ||
      requestHeaders.get("x-vercel-id") ||
      crypto.randomUUID(),
    route,
    method,
  };
}

export function getRouteRequestContext(
  request: NextRequest,
): RequestSecurityContext {
  return {
    ipAddress:
      firstForwardedIp(request.headers.get("x-forwarded-for")) ||
      request.headers.get("x-real-ip") ||
      "unknown",
    userAgent: request.headers.get("user-agent") || "",
    requestId:
      request.headers.get("x-request-id") ||
      request.headers.get("x-vercel-id") ||
      crypto.randomUUID(),
    route: request.nextUrl.pathname,
    method: request.method,
  };
}
