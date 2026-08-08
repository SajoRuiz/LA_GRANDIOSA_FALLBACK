import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getSupabaseRuntimeConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "http://127.0.0.1:54321";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "placeholder-key";

  return { url, key };
}

type SupabaseCookieMutation = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, key } = getSupabaseRuntimeConfig();

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: SupabaseCookieMutation[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    // getClaims verifies the access token and refreshes it when needed.
    await supabase.auth.getClaims();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Supabase session bootstrap skipped:", error);
    }
  }

  return response;
}
