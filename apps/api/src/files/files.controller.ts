import { Body, Controller, Get, Header, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { askUploadResponseSchema, askUploadSchema, completeUploadSchema, uploadedFileSchema, uploadRules, type AskUploadInput, type CompleteUploadInput } from '@creavent/shared';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { FilesService } from './files.service.js';
import { STORAGE, type ObjectStorage } from './storage.js';

@Controller('files')
@UseGuards(AuthGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @ResponseSchema(askUploadResponseSchema)
  ask(@CurrentUser() user: SessionUser, @Body({ schema: askUploadSchema }) body: AskUploadInput) {
    return this.files.ask(user.id, body);
  }

  @Post(':id/complete')
  @ResponseSchema(uploadedFileSchema)
  complete(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: completeUploadSchema }) body: CompleteUploadInput,
  ) {
    return this.files.complete(user.id, id, body.crop);
  }

  // Opens a private file: checks who is asking and sends them to an address
  // that works for 5 minutes. Every view gets a new one (spec §11.6).
  @Get(':id')
  async open(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const url = await this.files.privateUrl(user, id);
    res.setHeader('Cache-Control', 'private, no-store');
    res.redirect(302, url);
  }
}

const pictureName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

// Public pictures, for anyone. Served through the API because some networks
// block the bucket's r2.dev address. Only names the upload flow makes are read.
@Controller('files/public')
export class PublicFilesController {
  constructor(@Inject(STORAGE) private readonly storage: ObjectStorage) {}

  @Get(':purpose/:name')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async picture(@Param('purpose') purpose: string, @Param('name') name: string) {
    if (!Object.hasOwn(uploadRules, purpose) || !pictureName.test(name)) throw new NotFoundException();
    const body = await this.storage.get('public', `${purpose}/${name}`);
    if (!body) throw new NotFoundException();
    return new StreamableFile(body, { type: 'image/webp' });
  }
}
