import { createBrowserClient } from "@supabase/ssr";

function getSupabaseRuntimeConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "http://127.0.0.1:54321";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "placeholder-key";

  return { url, key };
}

export function createSupabaseBrowserClient() {
  const { url, key } = getSupabaseRuntimeConfig();

  return createBrowserClient(url, key);
}
