import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseRuntimeConfig();

  try {
    return createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: SupabaseCookieMutation[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as never);
          });
        },
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Supabase server client unavailable:", error);
    }

    return createServerClient("http://127.0.0.1:54321", "placeholder-key", {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // noop
        },
      },
    });
  }
}
