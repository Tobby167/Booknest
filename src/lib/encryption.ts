import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-cbc";

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    // Dev fallback — must be replaced in production
    return Buffer.from("booknest_dev_key_32chars_padding!", "utf8").subarray(0, 32);
  }
  // Accept a 64-char hex string or a raw 32-char string
  if (key.length === 64) return Buffer.from(key, "hex");
  return Buffer.from(key.padEnd(32, "0").slice(0, 32), "utf8");
}

/**
 * Encrypts plaintext → "iv_hex:ciphertext_hex"
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts "iv_hex:ciphertext_hex" → plaintext
 */
export function decrypt(encryptedValue: string): string {
  const [ivHex, dataHex] = encryptedValue.split(":");
  if (!ivHex || !dataHex) throw new Error("Invalid encrypted value format.");
  const iv = Buffer.from(ivHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
