import type { ObjectStorage, Bucket } from '../../src/files/storage.js';

// R2 stand-in for tests. "Uploading" is writing to the map directly.
export class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  async presignPut(bucket: Bucket, key: string, contentType: string, sizeBytes: number) {
    return {
      url: `https://storage.test/${bucket}/${key}`,
      headers: { 'Content-Type': contentType, 'Content-Length': String(sizeBytes) },
    };
  }

  async get(bucket: Bucket, key: string) {
    return this.objects.get(`${bucket}/${key}`)?.body ?? null;
  }

  async put(bucket: Bucket, key: string, body: Buffer, contentType: string) {
    this.objects.set(`${bucket}/${key}`, { body, contentType });
  }

  async delete(bucket: Bucket, key: string) {
    this.objects.delete(`${bucket}/${key}`);
  }

  async presignGet(key: string, downloadName?: string) {
    return `https://storage.test/private/${key}?expires=300${downloadName ? `&download=${downloadName}` : ''}`;
  }

  publicUrl(key: string) {
    return `https://files.test/${key}`;
  }

  // Test helper: what the browser's PUT to the signed address would do.
  upload(key: string, body: Buffer, contentType = 'image/png') {
    this.objects.set(`private/${key}`, { body, contentType });
  }
}
