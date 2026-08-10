import type { NextRequest } from "next/server";

import { updateSupabaseSession } from "./lib/supabase/proxy";

function supabaseOrigins(): string[] {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!value) {
    return ["https://*.supabase.co"];
  }

  try {
    const url = new URL(value);
    const projectRef = url.hostname.split(".")[0];

    return [
      url.origin,
      `https://${projectRef}.storage.supabase.co`,
      "https://*.supabase.co",
    ];
  } catch {
    return ["https://*.supabase.co"];
  }
}

function contentSecurityPolicy(): string {
  const development =
    process.env.NODE_ENV !== "production"
      ? " 'unsafe-eval'"
      : "";
  const upgrade =
    process.env.NODE_ENV === "production"
      ? "; upgrade-insecure-requests"
      : "";
  const connections = supabaseOrigins().join(" ");

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "media-src 'self' blob: https://*.supabase.co",
    "font-src 'self' data:",
    `connect-src 'self' ${connections} wss://*.supabase.co`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    `manifest-src 'self'${upgrade}`,
  ].join("; ");
}

function isPrivatePath(pathname: string): boolean {
  return [
    "/auth",
    "/portal",
    "/admin",
    "/order",
    "/cart",
    "/checkout",
    "/api",
  ].some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const response = await updateSupabaseSession(request);
  const requestId =
    request.headers.get("x-request-id") ||
    request.headers.get("x-vercel-id") ||
    crypto.randomUUID();

  response.headers.set("x-request-id", requestId);
  response.headers.set(
    "Content-Security-Policy",
    contentSecurityPolicy(),
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-site");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000",
    );
  }

  if (isPrivatePath(request.nextUrl.pathname)) {
    response.headers.set(
      "Cache-Control",
      "private, no-store, max-age=0, must-revalidate",
    );
    response.headers.set(
      "X-Robots-Tag",
      "noindex, nofollow, noarchive, nosnippet",
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|mov|pdf)$).*)",
  ],
};
