import { expect, test, type Browser, type Page } from "@playwright/test"
import pg from "pg"

// The pop-up path (development plan Phase 6, user flows 10 to 12): a vendor
// with no host approval opens Pop-ups and is approved through the earned
// route, drafts a pop-up, fills the form, announces it, and the public sees
// it. An admin then revokes host approval and the pop-up disappears.
// Uses the seeded demo accounts (vendor@ and admin@creavent.test) with
// SEED_PASSWORD, no sign-ups. vendor@'s host state is reset first, so the
// test can run again.

const run = Date.now().toString(36)
const popupName = `E2E Pop-up ${run}`
const hostEmail = "vendor@creavent.test"

const db = new pg.Client({ connectionString: process.env.DATABASE_URL })

test.beforeAll(async () => {
  await db.connect()
  // Back to "not submitted", the state the seed leaves vendor@ in, and drop
  // pop-ups an earlier run left behind.
  await db.query(
    `DELETE FROM events WHERE name LIKE 'E2E Pop-up %' AND host_vendor_profile_id IN
       (SELECT vp.id FROM vendor_profiles vp JOIN users u ON u.id = vp.user_id WHERE u.email = $1)`,
    [hostEmail]
  )
  await db.query(
    `UPDATE user_roles SET approval_status = 'not_submitted', approval_source = NULL, approval_submitted_at = NULL,
       rejection_reason = NULL, host_revoked_at = NULL, reviewed_at = NULL, reviewed_by = NULL
     WHERE role = 'vendor' AND user_id = (SELECT id FROM users WHERE email = $1)`,
    [hostEmail]
  )
})

test.afterAll(async () => {
  await db.end()
})

async function signIn(browser: Browser, email: string, pass: string) {
  const page = await browser.newPage()
  await page.goto("/login")
  // Retried until React has hydrated the form (slow on a dev server).
  await expect(async () => {
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password", { exact: true }).fill(pass)
    await page.getByRole("button", { name: "Log in" }).click()
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 5_000 })
  }).toPass({ timeout: 90_000 })
  return page
}

// A plain 1280 x 720 image made in the page and uploaded to R2 through the
// real Ask, Upload, Complete flow.
async function uploadCover(page: Page) {
  return page.evaluate(async () => {
    const canvas = document.createElement("canvas")
    canvas.width = 1280
    canvas.height = 720
    const g = canvas.getContext("2d")!
    g.fillStyle = "#c93c17"
    g.fillRect(0, 0, 1280, 720)
    const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/png"))
    const post = (url: string, body: unknown) =>
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json())
    const ask = await post("/api/files", { purpose: "event_cover", mimeType: "image/png", sizeBytes: blob.size })
    await fetch(ask.uploadUrl, { method: "PUT", headers: ask.headers, body: blob })
    const done = await post(`/api/files/${ask.fileId}/complete`, {})
    return done.id as string
  })
}

test("a vendor hosts a pop-up and an admin revokes it", async ({ browser }) => {
  const vendor = await signIn(browser, hostEmail, process.env.SEED_PASSWORD!)

  // 1. Opening Pop-ups approves the vendor through the earned route.
  await vendor.goto("/vendor/popups")
  await expect(vendor.getByText("You're approved to host pop-ups")).toBeVisible()
  await expect(vendor.getByText("Approved", { exact: true }).first()).toBeVisible()

  // 2. A draft starts from a name.
  await vendor.getByRole("link", { name: "Host a pop-up" }).first().click()
  await vendor.getByLabel("Pop-up name").fill(popupName)
  await vendor.getByRole("button", { name: "Create draft" }).click()
  await vendor.waitForURL(/\/vendor\/popups\/[0-9a-f-]{36}$/)
  await expect(vendor.getByRole("heading", { name: popupName })).toBeVisible()
  await expect(vendor.getByRole("button", { name: "Announce" })).toBeDisabled()

  // 3. The form is filled and saved. The cover goes up through the API (the
  // file picker has its own test).
  const id = vendor.url().split("/").pop()!
  const day = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  await vendor.getByLabel("Description").fill("An end-to-end test pop-up.")
  await vendor.getByLabel("Start date").fill(day)
  await vendor.getByLabel("End date").fill(day)
  await vendor.getByLabel("Opens").fill("10:00")
  await vendor.getByLabel("Closes").fill("18:00")
  await vendor.getByLabel("Venue name").fill("Test Café")
  await vendor.getByLabel("Address").fill("Lanang")
  await vendor.getByLabel("City").selectOption("Davao City")
  await vendor.getByRole("button", { name: "Save", exact: true }).click()
  await expect(vendor.getByText("Pop-up saved")).toBeVisible()
  const cover = await uploadCover(vendor)
  const status = await vendor.evaluate(
    async ({ id, cover }) => {
      const { details: d } = await fetch(`/api/vendor/popups/${id}`).then((r) => r.json())
      const { cover: _cover, ...rest } = d
      const res = await fetch(`/api/vendor/popups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, coverFileId: cover }),
      })
      return res.status
    },
    { id, cover }
  )
  expect(status).toBe(200)
  await vendor.reload()
  await expect(vendor.getByText("6 of 6 done")).toBeVisible()

  // 4. Announce.
  await vendor.getByRole("button", { name: "Announce", exact: true }).click()
  await vendor.getByRole("button", { name: "Announce pop-up" }).click()
  await expect(vendor.getByText("Your pop-up is on the events page")).toBeVisible()

  // 5. The public sees it on its page and in the listing, with the host block.
  const slug = (await db.query<{ slug: string }>("SELECT slug FROM events WHERE name = $1", [popupName])).rows[0].slug
  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto(`/events/${slug}`)
  await expect(visitor.getByRole("heading", { name: popupName })).toBeVisible()
  await expect(visitor.getByText("Approved by Creavent").first()).toBeVisible()
  await visitor.goto(`/?q=${encodeURIComponent(popupName)}`)
  await expect(visitor.getByText(popupName).first()).toBeVisible()

  // 6. An admin revokes host approval from the user page.
  const admin = await signIn(browser, "admin@creavent.test", process.env.SEED_PASSWORD!)
  const userId = (await db.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [hostEmail])).rows[0].id
  await admin.goto(`/admin/users/${userId}`)
  await admin.getByRole("button", { name: "Revoke host approval" }).click()
  await admin.getByLabel("Reason they'll see").fill("E2E: the page could not be verified.")
  await admin.getByRole("button", { name: /^Revoke and email/ }).click()
  await expect
    .poll(async () => (await db.query("SELECT host_revoked_at FROM user_roles WHERE user_id = $1 AND role = 'vendor'", [userId])).rows[0]?.host_revoked_at)
    .not.toBeNull()

  // 7. The pop-up is hidden from the public and the host sees why.
  await visitor.goto(`/events/${slug}`)
  await expect(visitor.getByRole("heading", { name: "We can't find this page" })).toBeVisible()
  await vendor.goto(`/vendor/popups/${id}`)
  await expect(vendor.getByText("Hidden by Creavent")).toBeVisible()
})
