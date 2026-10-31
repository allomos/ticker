import { env } from "cloudflare:test";
import { vi } from "vitest";
import { app } from "../../src/worker/index";

export const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

/** Asks for a sign-in link on localhost and returns the token written to the log. */
export async function requestLink(email: string, ip = "198.51.100.1"): Promise<string> {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const res = await app.request("http://localhost/auth/email", json({ email }, { "cf-connecting-ip": ip }), env);
    if (res.status !== 200) throw new Error(`sign-in request failed: ${res.status}`);
    const line = log.mock.calls.map((c) => String(c[0])).find((l) => l.includes("token="))!;
    return new URL(line.split(" ").pop()!).searchParams.get("token")!;
  } finally {
    log.mockRestore();
  }
}

/** Signs in and returns the session cookie to send with later requests. */
export async function signIn(email: string): Promise<string> {
  const token = await requestLink(email);
  const res = await app.request("http://localhost/auth/verify", json({ token }), env);
  const cookie = res.headers.get("set-cookie")!;
  return cookie.split(";")[0];
}
