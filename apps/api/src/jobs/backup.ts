import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const manilaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });

// Where dumps go. Only the worker has it, with its own R2 key for the backups
// bucket, so the key the web app and API share can't read the dumps.
export interface BackupStore {
  upload(key: string, body: Readable): Promise<void>;
  remove(key: string): Promise<void>;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set (docs/deployment.md lists the backup settings)`);
  return value;
}

export function createR2BackupStore(): BackupStore {
  const bucket = required('R2_BACKUPS_BUCKET');
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: required('R2_BACKUPS_ACCESS_KEY_ID'), secretAccessKey: required('R2_BACKUPS_SECRET_ACCESS_KEY') },
  });
  return {
    // A multipart upload, so the dump streams through without being held in memory.
    async upload(key, body) {
      await new Upload({ client, params: { Bucket: bucket, Key: key, Body: body, ContentType: 'application/octet-stream' } }).done();
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

// Custom format is compressed and restores with pg_restore into a fresh
// database (the restore drill, development plan 6.5). The password goes to
// pg_dump through PGPASSWORD, never on the command line, where the process
// list and error messages would show it.
export function pgDumpCommand(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const password = decodeURIComponent(url.password);
  url.password = '';
  return { args: ['--format=custom', '--no-owner', '--no-acl', `--dbname=${url.toString()}`], password };
}

// pg_dump must match the database's major version (17). The worker's Docker
// image installs it (docs/deployment.md). `done` settles when it exits; a
// failure carries only pg_dump's own message.
function pgDump(databaseUrl: string): { stream: Readable; done: Promise<void> } {
  const { args, password } = pgDumpCommand(databaseUrl);
  const child = spawn('pg_dump', args, { env: { ...process.env, PGPASSWORD: password }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-2000);
  });
  const done = new Promise<void>((resolve, reject) => {
    child.on('error', (error) => reject(new Error(`pg_dump failed: ${error.message}`)));
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump failed: ${stderr.trim() || `exit code ${code}`}`))));
  });
  return { stream: child.stdout, done };
}

// The nightly backup (architecture §9.3): the whole database to the backups
// bucket, one file per night named by its date in the Philippines. A lifecycle
// rule on the bucket deletes files after 30 days. Returns the object key.
export async function backupDatabase(
  store: BackupStore,
  options: { databaseUrl: string; now?: Date; dump?: (databaseUrl: string) => { stream: Readable; done: Promise<void> } },
) {
  const key = `db/creavent-${manilaDate.format(options.now ?? new Date())}.dump`;
  const { stream, done } = (options.dump ?? pgDump)(options.databaseUrl);
  const results = await Promise.allSettled([store.upload(key, stream), done]);
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) {
    await store.remove(key).catch(() => undefined);
    throw failed.reason;
  }
  return key;
}
