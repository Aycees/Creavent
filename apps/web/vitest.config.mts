import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// Component tests (docs/development-plan.md §7), set up as in Next's Vitest guide.
// Vite resolves the `@/` alias from tsconfig.json itself.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
})
