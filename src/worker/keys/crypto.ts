// Encryption of users' API keys: AES-256-GCM with the Worker secret KEY_ENCRYPTION_KEY (32 random
// bytes, base64) as master key. The user's id is bound in as additional data, so a key copied to
// another user's row does not decrypt.
import type { Env } from "../env";

/** The master key's version; a new KEY_ENCRYPTION_KEY gets the next number. */
export const KEY_VERSION = 1;

const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function masterKey(env: Env, version: number): Promise<CryptoKey> {
  if (version !== KEY_VERSION) throw new Error(`No master key version ${version}`);
  if (!env.KEY_ENCRYPTION_KEY) throw new Error("KEY_ENCRYPTION_KEY is not set");
  const raw = unb64(env.KEY_ENCRYPTION_KEY);
  if (raw.length !== 32) throw new Error("KEY_ENCRYPTION_KEY must be 32 bytes, base64");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export interface Sealed {
  ciphertext: string;
  nonce: string;
  version: number;
}

export async function seal(env: Env, userId: string, plaintext: string): Promise<Sealed> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode(userId) },
    await masterKey(env, KEY_VERSION),
    new TextEncoder().encode(plaintext),
  );
  return { ciphertext: b64(data), nonce: b64(nonce), version: KEY_VERSION };
}

export async function open(env: Env, userId: string, sealed: Sealed): Promise<string> {
  const data = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(sealed.nonce), additionalData: new TextEncoder().encode(userId) },
    await masterKey(env, sealed.version),
    unb64(sealed.ciphertext),
  );
  return new TextDecoder().decode(data);
}
