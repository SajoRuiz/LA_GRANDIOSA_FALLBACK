import { createHash, randomBytes } from "crypto";

const ACTIVATION_CODE_LENGTH = 24;

export function generateActivationCode(): string {
  return randomBytes(Math.ceil(ACTIVATION_CODE_LENGTH / 2))
    .toString("hex")
    .slice(0, ACTIVATION_CODE_LENGTH)
    .toUpperCase();
}

export function hashActivationCode(code: string): string {
  const normalizedCode = String(code).trim().toUpperCase();

  return createHash("sha256")
    .update(normalizedCode, "utf8")
    .digest("hex");
}
