import { describe, expect, it } from "vitest"

import { safeNext } from "./safe-next"

describe("safeNext", () => {
  it.each(["/account", "/vendor/applications/42?tab=payment", "/organizer#top"])("keeps the same-site path %s", (path) => {
    expect(safeNext(path)).toBe(path)
  })

  it.each([
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    " /account",
    "javascript:alert(1)",
    "account",
    "",
    null,
  ])("refuses %s", (value) => {
    expect(safeNext(value)).toBeUndefined()
  })
})
