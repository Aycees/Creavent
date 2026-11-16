// @vitest-environment node
import { revalidateTag } from "next/cache"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { POST } from "./route"

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

const post = (body: unknown, secret?: string) =>
  POST(
    new Request("http://localhost:3100/internal/revalidate", {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret ? { "x-revalidate-secret": secret } : {}) },
      body: JSON.stringify(body),
    })
  )

// The API asks for cached public pages to be refreshed (decision Q1).
describe("POST /internal/revalidate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("REVALIDATE_SECRET", "s3cret")
  })
  afterEach(() => vi.unstubAllEnvs())

  it("expires each tag at once when the secret matches", async () => {
    const res = await post({ tags: ["listing", "event:1"] }, "s3cret")

    expect(res.status).toBe(204)
    expect(revalidateTag).toHaveBeenCalledWith("listing", { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith("event:1", { expire: 0 })
  })

  it("refuses a wrong or missing secret", async () => {
    expect((await post({ tags: ["listing"] }, "nope")).status).toBe(401)
    expect((await post({ tags: ["listing"] })).status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("refuses when no secret is configured", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "")

    expect((await post({ tags: ["listing"] }, "")).status).toBe(401)
  })

  it("refuses a body without tags", async () => {
    expect((await post({ tags: "listing" }, "s3cret")).status).toBe(400)
    expect((await post({ tags: [""] }, "s3cret")).status).toBe(400)
  })
})
