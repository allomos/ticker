import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest(async () => ({
            main: "./src/worker/index.ts",
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: await readD1Migrations("./migrations"),
                TWELVE_DATA_API_KEY: "test-key",
                ALPHA_VANTAGE_API_KEY: "test-av-key",
                MARKET_OWNER_EMAIL: "Owner@Example.com",
                RESEND_API_KEY: "",
              },
            },
          })),
        ],
        test: {
          name: "worker",
          include: ["test/worker/**/*.test.ts"],
          setupFiles: ["./test/worker/setup.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "app",
          include: ["test/app/**/*.test.tsx", "test/app/**/*.test.ts"],
          environment: "jsdom",
          setupFiles: ["./test/app/setup.ts"],
        },
      },
    ],
  },
});
