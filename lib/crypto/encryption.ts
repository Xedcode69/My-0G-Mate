import crypto from "node:crypto";

const algorithm = "aes-256-gcm";

function getMasterKey() {
  const configured = process.env.MEMORY_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length === 32) return key;
  }
  return crypto.createHash("sha256").update("local-development-memory-key").digest();
}

export function encryptJson(payload: unknown) {
  return encryptWithKey(payload, getMasterKey());
}

export function encryptCompanionJson(payload: unknown, walletAddress: string, companionId: string) {
  return encryptWithKey(payload, deriveCompanionKey(walletAddress, companionId));
}

function encryptWithKey(payload: unknown, key: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function deriveCompanionKey(walletAddress: string, companionId: string) {
  const salt = Buffer.from(walletAddress.trim().toLowerCase(), "utf8");
  const info = Buffer.from(`mymate:companion-archive:v1:${companionId}`, "utf8");
  return Buffer.from(crypto.hkdfSync("sha256", getMasterKey(), salt, info, 32));
}
