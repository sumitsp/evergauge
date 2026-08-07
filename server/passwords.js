import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(String(password), salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const derived = await scrypt(String(password), salt, 64);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(derived);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
