import crypto from "node:crypto";

// AES-256-GCM encryption for secrets at rest (per-user Gemini API keys).
// The key comes from APP_ENCRYPTION_KEY (64 hex chars = 32 bytes).

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard nonce length

function getKey(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("APP_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "APP_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters",
    );
  }
  return key;
}

export type EncryptedValue = {
  ciphertext: string; // base64
  iv: string; // base64
  tag: string; // base64
};

export function encrypt(plaintext: string): EncryptedValue {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decrypt(value: EncryptedValue): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(value.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Mask a secret for display, e.g. "AIza…7Yk". */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) return "••••";
  return `${secret.slice(0, 4)}…${secret.slice(-3)}`;
}
