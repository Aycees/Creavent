import { Controller, Get } from '@nestjs/common';
import { healthResponseSchema, type HealthResponse } from '@creavent/shared';
import { ResponseSchema } from '../response-schema.decorator.js';

@Controller('health')
export class HealthController {
  @Get()
  @ResponseSchema(healthResponseSchema)
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
