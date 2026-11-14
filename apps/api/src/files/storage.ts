import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// The two buckets of spec §11.2. Uploads land in private/incoming/ first.
export type Bucket = 'public' | 'private';

export interface ObjectStorage {
  presignPut(bucket: Bucket, key: string, contentType: string, sizeBytes: number): Promise<{ url: string; headers: Record<string, string> }>;
  get(bucket: Bucket, key: string): Promise<Buffer | null>;
  put(bucket: Bucket, key: string, body: Buffer, contentType: string): Promise<void>;
  delete(bucket: Bucket, key: string): Promise<void>;
  publicUrl(key: string): string;
  // A signed address that reads one private object for 5 minutes (spec §11.6).
  presignGet(key: string): Promise<string>;
}

export const STORAGE = Symbol('STORAGE');

// Values are trimmed: a stray space pasted into .env would otherwise end up
// inside every image address.
function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set (docs/deployment.md lists the R2 settings)`);
  return value;
}

// Cloudflare R2 through the S3 SDK (docs/architecture.md §7). Only the API and
// worker hold these keys; browsers get signed addresses.
export class R2Storage implements ObjectStorage {
  private client?: S3Client;

  private s3() {
    this.client ??= new S3Client({
      region: 'auto',
      endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required('R2_ACCESS_KEY_ID'),
        secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
      },
    });
    return this.client;
  }

  private name(bucket: Bucket) {
    return bucket === 'public' ? required('R2_PUBLIC_BUCKET') : required('R2_PRIVATE_BUCKET');
  }

  async presignPut(bucket: Bucket, key: string, contentType: string, sizeBytes: number) {
    const command = new PutObjectCommand({
      Bucket: this.name(bucket),
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    });
    // Signed for the declared type and size, valid for 5 minutes (spec §11.3).
    const url = await getSignedUrl(this.s3(), command, {
      expiresIn: 5 * 60,
      signableHeaders: new Set(['content-type', 'content-length']),
    });
    return { url, headers: { 'Content-Type': contentType } };
  }

  async get(bucket: Bucket, key: string) {
    try {
      const res = await this.s3().send(new GetObjectCommand({ Bucket: this.name(bucket), Key: key }));
      return Buffer.from(await res.Body!.transformToByteArray());
    } catch (error) {
      if ((error as { name?: string }).name === 'NoSuchKey') return null;
      throw error;
    }
  }

  async put(bucket: Bucket, key: string, body: Buffer, contentType: string) {
    await this.s3().send(
      new PutObjectCommand({
        Bucket: this.name(bucket),
        Key: key,
        Body: body,
        ContentType: contentType,
        // Each address is unique to one upload, so it can be cached for a long time (spec §11.6).
        CacheControl: bucket === 'public' ? 'public, max-age=31536000, immutable' : undefined,
      }),
    );
  }

  async delete(bucket: Bucket, key: string) {
    await this.s3().send(new DeleteObjectCommand({ Bucket: this.name(bucket), Key: key }));
  }

  async presignGet(key: string) {
    return getSignedUrl(this.s3(), new GetObjectCommand({ Bucket: this.name('private'), Key: key }), { expiresIn: 5 * 60 });
  }

  // The bucket's own address when R2_PUBLIC_URL is set (a custom domain),
  // otherwise the API's picture route.
  publicUrl(key: string) {
    const base = process.env.R2_PUBLIC_URL?.trim();
    return base ? `${base.replace(/\/$/, '')}/${key}` : `/api/files/public/${key}`;
  }
}
