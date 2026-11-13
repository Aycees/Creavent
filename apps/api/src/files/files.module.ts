import { Global, Module } from '@nestjs/common';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';
import { R2Storage, STORAGE } from './storage.js';

@Global()
@Module({
  controllers: [FilesController],
  providers: [FilesService, { provide: STORAGE, useFactory: () => new R2Storage() }],
  exports: [FilesService],
})
export class FilesModule {}
