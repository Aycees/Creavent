import createClient from 'openapi-fetch';
import type { paths } from './schema.js';

// A fetch client typed from the API's OpenAPI document. Paths include the
// /api prefix, so baseUrl is the API's origin (or '' behind the web rewrite).
export function createApiClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}
