import { createApiClient } from "@creavent/shared"

// The typed API client for the browser. Paths start with /api, which this
// site forwards to the API, so the base URL is empty.
export const api = createApiClient("")
