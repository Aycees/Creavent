import { z } from 'zod';

// The body of every error response from the API (docs/architecture.md §3.4).
export const errorResponseSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  // Only on validation errors: one entry per invalid field.
  details: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
