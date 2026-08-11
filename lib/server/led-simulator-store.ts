import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SimulatorStatus =
  | "pending"
  | "processing"
  | "submitted"
  | "acknowledged"
  | "released"
  | "live"
  | "failed"
  | "cancelled";

export interface LedSimulatorRecord {
  external_reference: string;
  provider_key: string;
  release_id: string | null;
  order_id: string | null;
  status: SimulatorStatus;
  request_payload: Record<string, unknown>;
  status_payload: Record<string, unknown>;
  message: string | null;
}

const storeFilePath = join("/tmp", "la-grandiosa-led-simulator-store.json");

function readMemoryStore(): Map<string, LedSimulatorRecord> {
  if (!existsSync(storeFilePath)) {
    return new Map();
  }

  try {
    const raw = JSON.parse(readFileSync(storeFilePath, "utf8")) as Array<
      [string, LedSimulatorRecord]
    >;
    return new Map(raw);
  } catch {
    return new Map();
  }
}

function writeMemoryStore(store: Map<string, LedSimulatorRecord>) {
  writeFileSync(
    storeFilePath,
    JSON.stringify(Array.from(store.entries()), null, 2),
    "utf8",
  );
}

function isMissingRelation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String((error as any).code ?? "") : "";
  const message =
    "message" in error ? String((error as any).message ?? "") : "";

  return code === "PGRST205" || /led_provider_simulations/i.test(message);
}

export async function createSimulatorRecord(
  record: LedSimulatorRecord,
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("led_provider_simulations")
    .insert(record);

  if (!error) {
    return;
  }

  if (!isMissingRelation(error)) {
    throw new Error(error.message);
  }

  const store = readMemoryStore();
  store.set(record.external_reference, record);
  writeMemoryStore(store);
}

export async function getSimulatorRecord(externalReference: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("led_provider_simulations")
    .select("provider_key,external_reference,status,status_payload,message")
    .eq("external_reference", externalReference)
    .single();

  if (!error && data) {
    return data as LedSimulatorRecord;
  }

  if (!isMissingRelation(error)) {
    if (error) {
      throw new Error(error.message);
    }
    return null;
  }

  const store = readMemoryStore();
  return store.get(externalReference) ?? null;
}

export async function updateSimulatorRecord(
  externalReference: string,
  updates: Partial<LedSimulatorRecord>,
) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("led_provider_simulations")
    .update(updates)
    .eq("external_reference", externalReference)
    .select("provider_key,external_reference,status,status_payload,message")
    .single();

  if (!error && data) {
    return data as LedSimulatorRecord;
  }

  if (!isMissingRelation(error)) {
    if (error) {
      throw new Error(error.message);
    }
    return null;
  }

  const store = readMemoryStore();
  const existing = store.get(externalReference);
  if (!existing) {
    return null;
  }

  const next = { ...existing, ...updates };
  store.set(externalReference, next);
  writeMemoryStore(store);
  return next;
}