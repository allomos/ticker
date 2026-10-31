import { Hono } from "hono";
import { auth } from "./auth/routes";
import { loadUser, sameOrigin, type AppEnv } from "./auth/session";
import type { Env } from "./env";
import { lists } from "./lists/routes";
import { prune } from "./market/budget";
import { market } from "./market/routes";

export const app = new Hono<AppEnv>();

app.use("/api/*", sameOrigin, loadUser);
app.use("/auth/*", sameOrigin, loadUser);

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/lists", lists);
app.route("/api", market);
app.route("/auth", auth);

app.notFound((c) =>
  c.req.path.startsWith("/api/") || c.req.path.startsWith("/auth/")
    ? c.json({ error: "not_found" }, 404)
    : c.env.ASSETS.fetch(c.req.raw),
);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "server_error" }, 500);
});

/** Daily clean-up: old budget windows, old cached data, used sign-in links, ended sessions. */
export async function cleanUp(env: Env, now = Date.now()) {
  await prune(env.DB, now);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM login_tokens WHERE created_at < ?1").bind(now - 2 * 86_400_000),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?1").bind(now),
  ]);
}

export default {
  fetch: app.fetch,
  async scheduled(_controller, env) {
    await cleanUp(env);
  },
} satisfies ExportedHandler<Env>;
