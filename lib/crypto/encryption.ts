import crypto from "node:crypto";

const algorithm = "aes-256-gcm";

function getKey() {
  const configured = process.env.MEMORY_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length === 32) return key;
  }
  return crypto.createHash("sha256").update("local-development-memory-key").digest();
}

export function encryptJson(payload: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}
