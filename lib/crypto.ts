import crypto from "crypto";
import { getServerEnv } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const raw = getServerEnv().ENCRYPTION_KEY;

  if (raw.length === 64) {
    return Buffer.from(raw, "hex");
  }

  const base64Attempt = Buffer.from(raw, "base64");
  if (base64Attempt.length === 32) {
    return base64Attempt;
  }

  throw new Error("ENCRYPTION_KEY must be 32 bytes in base64 or 64 hex chars");
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(payload: string): string {
  const key = getKey();
  const blob = Buffer.from(payload, "base64");

  const iv = blob.subarray(0, IV_LENGTH);
  const tag = blob.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = blob.subarray(IV_LENGTH + 16);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
