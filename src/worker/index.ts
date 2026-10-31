import { Hono } from "hono";
import type { Env } from "./env";
import { prune } from "./market/budget";
import { market } from "./market/routes";

export const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api", market);

app.notFound((c) =>
  c.req.path.startsWith("/api/") ? c.json({ error: "not_found" }, 404) : c.env.ASSETS.fetch(c.req.raw),
);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "server_error" }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_controller, env) {
    await prune(env.DB);
  },
} satisfies ExportedHandler<Env>;
