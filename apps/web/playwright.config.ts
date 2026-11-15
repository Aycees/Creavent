import { readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

// The local API settings (apps/api/.env) the test needs: the web address, the
// database it reads verification links from, and the seed admin's password.
// Only these are read, so no other secret reaches the test process or traces.
const needed = ["WEB_URL", "DATABASE_URL", "SEED_PASSWORD"]
const env = Object.fromEntries(
  readFileSync(path.join(__dirname, "../api/.env"), "utf8")
    .split("\n")
    .map((line): [string, string] => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim().replace(/^"(.*)"$/, "$1")])
    .filter(([key]) => needed.includes(key))
)
for (const [key, value] of Object.entries(env)) process.env[key] ??= value

// The main path end to end (development plan 3.8). Runs locally against a
// running app (`pnpm dev`, the worker, and `pnpm db:seed`) and the R2 dev
// buckets, decided 2026-11-15. Not part of CI.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.e2e.ts",
  // Outside the repo: the dev server watches it, and writing results there
  // would reload the page under test.
  outputDir: path.join(os.tmpdir(), "creavent-e2e"),
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? process.env.WEB_URL ?? "http://localhost:3100",
    ...devices["Pixel 7"],
    // Traces would keep the typed seed password, so only screenshots are kept.
    screenshot: "only-on-failure",
  },
})
