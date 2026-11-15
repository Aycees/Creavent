import { expect, test, type Browser, type Page } from "@playwright/test"
import { deflateSync } from "node:zlib"
import pg from "pg"

// The main path to a confirmed spot (development plan 3.8, user flows 1 to
// 7): sign up and onboard an organizer and a vendor, approve the organizer,
// create and open an event, apply, approve, assign a slot, upload proof, and
// approve the payment. Phase 2's setup tabs are filled through the API from
// the organizer's signed-in page, since their screens have their own tests.

const run = Date.now().toString(36)
const password = "e2e-password-123"
const organizer = { name: "Erin Organizer", email: `e2e-org-${run}@creavent.test`, page: `E2E Flea ${run}` }
const vendor = { name: "Vic Vendor", email: `e2e-vendor-${run}@creavent.test`, shop: `E2E Ukay ${run}` }
const eventName = `E2E Night Market ${run}`

const db = new pg.Client({ connectionString: process.env.DATABASE_URL })

test.beforeAll(async () => {
  await db.connect()
})

test.afterAll(async () => {
  await db.end()
})

// The verification link from the outbox, as the email would carry it.
async function verificationLink(email: string) {
  for (let i = 0; i < 20; i++) {
    const { rows } = await db.query<{ url: string }>(
      "SELECT payload->>'url' AS url FROM email_notifications WHERE to_email = $1 AND type = 'email_verification' ORDER BY created_at DESC LIMIT 1",
      [email]
    )
    if (rows[0]) return rows[0].url
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`No verification email for ${email}`)
}

async function signUp(page: Page, who: { name: string; email: string }, role: "Run events" | "Sell at events") {
  await page.goto("/signup")
  // Retried until React has hydrated the page (slow on a dev server).
  await expect(async () => {
    await page.getByRole("radio", { name: new RegExp(role) }).check({ force: true, timeout: 2_000 })
    const box = page.getByRole("checkbox", { name: /I'm 18 or older/ })
    await box.click({ position: { x: 4, y: 4 }, timeout: 2_000 })
    await expect(box).toHaveAttribute("aria-checked", "true", { timeout: 1_000 })
  }).toPass({ timeout: 90_000 })
  await page.getByLabel("Full name").fill(who.name)
  await page.getByLabel("Email").fill(who.email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  // Radix checkboxes are buttons; the label's links sit beside them.
  // The label's Terms and Privacy links sit over the box, so use the keyboard.
  const terms = page.getByRole("checkbox", { name: /I agree to the Terms of use and Privacy notice/ })
  await terms.focus()
  await page.keyboard.press("Space")
  await expect(terms).toHaveAttribute("aria-checked", "true")
  await page.getByRole("button", { name: role === "Run events" ? "Create organizer account" : "Create vendor account" }).click()
  await expect(page.getByText(who.email)).toBeVisible()
  await page.goto(await verificationLink(who.email))
}

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

// A request from the signed-in page, through the web app's /api proxy.
async function api(page: Page, method: string, path: string, body?: unknown) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })
      const text = await res.text()
      if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text}`)
      return text ? JSON.parse(text) : null
    },
    { method, path, body }
  )
}

// A plain image of the given size, made in the page and uploaded to R2
// through the real Ask, Upload, Complete flow.
async function uploadImage(page: Page, purpose: string, width: number, height: number) {
  return page.evaluate(
    async ({ purpose, width, height }) => {
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const g = canvas.getContext("2d")!
      g.fillStyle = "#c93c17"
      g.fillRect(0, 0, width, height)
      const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/png"))
      const post = (url: string, body: unknown) =>
        fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json())
      const ask = await post("/api/files", { purpose, mimeType: "image/png", sizeBytes: blob.size })
      await fetch(ask.uploadUrl, { method: "PUT", headers: ask.headers, body: blob })
      const done = await post(`/api/files/${ask.fileId}/complete`, {})
      return done.id as string
    },
    { purpose, width, height }
  )
}

// A solid 600 x 900 PNG, like a phone screenshot of a receipt.
function png(width: number, height: number) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf: Buffer) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const sum = Buffer.alloc(4)
    sum.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, sum])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0xee)])
  const pixels = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", pixels), chunk("IEND", Buffer.alloc(0))])
}
const pngBytes = png(600, 900)
const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n")

test("a vendor gets a confirmed spot", async ({ browser }) => {
  // 1. The organizer signs up, onboards, and submits for review.
  const org = await browser.newPage()
  await signUp(org, organizer, "Run events")
  await org.getByRole("button", { name: "Continue" }).click()
  await org.getByLabel("Organizer name").fill(organizer.page)
  await org.getByRole("button", { name: "Continue" }).click()
  await org.getByLabel("Mobile number").fill("0917 482 1093")
  await org.getByLabel("Contact email").fill(organizer.email)
  await org.getByRole("button", { name: "Continue" }).click()
  await org.getByLabel("Link to your page or a past event").fill("https://www.facebook.com/e2eflea")
  await org.getByRole("button", { name: "Add link" }).click()
  await org.getByRole("button", { name: "Submit for review" }).click()
  await expect(org.getByText("Pending review").first()).toBeVisible()

  // 2. An admin approves the organizer.
  const admin = await signIn(browser, "admin@creavent.test", process.env.SEED_PASSWORD!)
  const { rows } = await db.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [organizer.email])
  await admin.goto(`/admin/approvals/${rows[0].id}`)
  await admin.getByText("Approve", { exact: true }).click()
  await admin.getByRole("button", { name: `Approve ${organizer.page}` }).click()
  await expect
    .poll(async () => (await db.query("SELECT approval_status FROM user_roles WHERE user_id = $1 AND role = 'organizer'", [rows[0].id])).rows[0]?.approval_status)
    .toBe("approved")

  // 3. The organizer creates the event, fills the setup, and opens it.
  await org.goto("/organizer/events/new")
  await org.getByLabel("Event name").fill(eventName)
  await org.getByRole("button", { name: "Create draft" }).click()
  await org.waitForURL(/\/organizer\/events\/[0-9a-f-]{36}$/)
  const eventId = org.url().split("/").pop()!
  const setup = await api(org, "GET", `/api/organizer/events/${eventId}`)
  const start = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
  const cover = await uploadImage(org, "event_cover", 1280, 720)
  const categories = await db.query<{ id: string; slug: string }>("SELECT id, slug FROM categories WHERE slug IN ('preloved-clothing')")
  const preloved = categories.rows[0].id
  await api(org, "PUT", `/api/organizer/events/${eventId}/details`, {
    name: eventName,
    eventTypeId: setup.details.eventTypeId,
    description: "An end-to-end test market.",
    startDate: start,
    endDate: start,
    opensAt: "17:00",
    closesAt: "23:00",
    venueName: "Test Grounds",
    addressLine: "Lanang",
    city: "Davao City",
    coverFileId: cover,
    vendorContactInfo: "Erin · 0917 482 1093",
    applicationsCloseAt: "",
    ingressInfo: "From 3 PM, Gate 2",
  })
  await api(org, "PUT", `/api/organizer/events/${eventId}/requirements`, {
    categories: [{ categoryId: preloved, maxVendors: 10 }],
    documents: [{ name: "Barangay business clearance", description: "", categoryId: null }],
  })
  await api(org, "PUT", `/api/organizer/events/${eventId}/policy`, { text: "Pay within 24 hours of assignment." })
  await api(org, "PUT", `/api/organizer/events/${eventId}/payments`, {
    deadlineHours: 24,
    methods: [{ channel: "gcash", accountName: "Erin O.", accountNumber: "0917 482 1093", qrFileId: null, notes: "" }],
  })
  await api(org, "POST", `/api/organizer/events/${eventId}/slots/row`, { section: "Main walkway", prefix: "A", from: "01", to: "03", sizeLabel: "2 × 2 m", price: 800 })
  await org.reload()
  await org.getByRole("button", { name: "Open to vendors" }).first().click()
  await org.getByRole("dialog").getByRole("button", { name: "Open to vendors" }).click()
  await expect(org.getByText("Your event is open to vendors")).toBeVisible()

  // 4. The vendor signs up, onboards, and applies.
  const ven = await browser.newPage()
  await signUp(ven, vendor, "Sell at events")
  await ven.getByRole("button", { name: "Continue" }).click()
  await ven.getByLabel("Shop name").fill(vendor.shop)
  await ven.getByRole("button", { name: "Preloved clothing" }).click()
  await ven.getByRole("button", { name: "Continue" }).click()
  await ven.getByRole("button", { name: "Skip for now" }).click()
  await ven.getByLabel("Mobile number").fill("0918 123 4567")
  await ven.getByRole("button", { name: "Finish setup" }).click()
  await expect(ven.getByRole("link", { name: "Go to your dashboard" })).toBeVisible()

  const slug = setup.slug
  await ven.goto(`/vendor/events/${slug}/apply`)
  await ven.getByRole("button", { name: /Preloved clothing/ }).click()
  await ven.getByLabel("Upload Barangay business clearance").setInputFiles({ name: "clearance.pdf", mimeType: "application/pdf", buffer: pdfBytes })
  await expect(ven.getByText("clearance.pdf")).toBeVisible()
  await ven.getByRole("button", { name: "Submit application" }).click()
  await ven.waitForURL(/\/vendor\/applications\/[0-9a-f-]{36}$/)
  const applicationUrl = ven.url()
  await expect(ven.getByText("Waiting for the organizer to review your application.")).toBeVisible()

  // 5. The organizer approves the application and assigns a slot.
  await org.goto(`/organizer/events/${eventId}/applications`)
  const card = org.getByRole("article", { name: vendor.shop })
  await card.getByRole("button", { name: "Approve" }).click()
  await org.getByRole("dialog").getByRole("button", { name: "Approve" }).click()
  await expect(org.getByText(`${vendor.shop} is approved.`, { exact: false })).toBeVisible()
  await org.goto(`/organizer/events/${eventId}/vendors`)
  await org.getByRole("button", { name: `Assign slot to ${vendor.shop}` }).click()
  await org.getByRole("dialog").getByRole("radio", { name: /A-02/ }).click()
  await org.getByRole("dialog").getByRole("button", { name: "Assign A-02" }).click()
  await expect(org.getByText(`${vendor.shop} got A-02.`, { exact: false })).toBeVisible()

  // 6. The vendor uploads proof of payment.
  await ven.goto(applicationUrl)
  await expect(ven.getByText("₱800").first()).toBeVisible()
  await ven.getByLabel(/choose a file/i).setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: pngBytes })
  await expect(ven.getByText(/receipt\.png/)).toBeVisible()
  await ven.getByLabel("Reference number (optional)").fill("7012 345 678901")
  await ven.getByRole("button", { name: "Submit proof" }).click()
  await expect(ven.getByText("Your proof is with the organizer. We'll email you when they review it.")).toBeVisible()

  // 7. The organizer approves the payment, and the vendor is confirmed.
  await org.reload()
  await org.getByRole("listitem", { name: `${vendor.shop}, A-02` }).getByRole("button", { name: "Review proof" }).click()
  await org.getByRole("dialog").getByRole("button", { name: "Approve payment" }).click()
  await expect(org.getByText(`${vendor.shop} is confirmed. A-02 is reserved.`)).toBeVisible()

  await ven.reload()
  await expect(ven.getByText("You're confirmed. Slot A-02 is yours.")).toBeVisible()
})
