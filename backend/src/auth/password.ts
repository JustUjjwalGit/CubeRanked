import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, hash] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const storedKey = Buffer.from(hash, "base64url");

  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}
