import { ConflictException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from './generated/prisma/client.js';
import { ApiExceptionFilter } from './api-exception.filter.js';

function reply(exception: unknown) {
  const sent: { body?: unknown; status?: number } = {};
  const adapter = { httpAdapter: { reply: (_res: unknown, body: unknown, status: number) => Object.assign(sent, { body, status }) } };
  const host = { switchToHttp: () => ({ getResponse: () => ({}) }) } as unknown as ArgumentsHost;
  new ApiExceptionFilter(adapter as unknown as HttpAdapterHost).catch(exception, host);
  return sent;
}

describe('ApiExceptionFilter', () => {
  it('answers a unique clash in the database with 409, not 500', () => {
    const clash = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '7' });

    expect(reply(clash)).toEqual({
      status: 409,
      body: { statusCode: 409, error: 'Conflict', message: 'Someone just saved the same thing. Try again.' },
    });
  });

  it('keeps other errors as they are', () => {
    expect(reply(new ConflictException('Taken')).status).toBe(409);
    expect(reply(new Error('boom')).status).toBe(500);
  });
});
