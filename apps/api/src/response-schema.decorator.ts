import { applyDecorators, SerializeOptions } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import type { z } from 'zod';

// One schema for a route's 200 response: the serializer validates what the
// handler returns, and the OpenAPI document describes it.
export function ResponseSchema(schema: z.ZodType) {
  return applyDecorators(
    SerializeOptions({ schema }),
    ApiOkResponse({ standardSchema: schema }),
  );
}
