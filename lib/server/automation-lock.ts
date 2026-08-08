import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface AutomationLockResult<T> {
  acquired: boolean;
  result?: T;
}

export async function withAutomationLock<T>(
  jobKey: string,
  ttlSeconds: number,
  work: () => Promise<T>,
): Promise<AutomationLockResult<T>> {
  const admin = createSupabaseAdminClient();
  const token = randomUUID();

  const { data, error } = await admin.rpc("acquire_automation_lock", {
    p_job_key: jobKey,
    p_lock_token: token,
    p_ttl_seconds: ttlSeconds,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data !== true) {
    return { acquired: false };
  }

  try {
    return { acquired: true, result: await work() };
  } finally {
    await admin.rpc("release_automation_lock", {
      p_job_key: jobKey,
      p_lock_token: token,
    });
  }
}
