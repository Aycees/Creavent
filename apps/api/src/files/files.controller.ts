import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { askUploadResponseSchema, askUploadSchema, uploadedFileSchema, type AskUploadInput } from '@creavent/shared';
import { AuthGuard, CurrentUser, type SessionUser } from '../auth/auth.guard.js';
import { ResponseSchema } from '../response-schema.decorator.js';
import { FilesService } from './files.service.js';

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
  complete(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.files.complete(user.id, id);
  }
}
