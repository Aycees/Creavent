import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ObjectStorage } from '../files/storage.js';

const run = promisify(execFile);
const manilaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });

// Custom format is compressed and restores with pg_restore into a fresh
// database (the restore drill, development plan 6.5).
export function pgDumpArgs(databaseUrl: string) {
  return ['--format=custom', '--no-owner', '--no-acl', `--dbname=${databaseUrl}`];
}

// pg_dump must match the database's major version (17). The worker's Docker
// image installs it (docs/deployment.md).
async function pgDump(databaseUrl: string) {
  const { stdout } = await run('pg_dump', pgDumpArgs(databaseUrl), { encoding: 'buffer', maxBuffer: 1024 * 1024 * 1024 });
  return stdout;
}

// The nightly backup (architecture §9.3): the whole database to the backups
// bucket, one file per night named by its date in the Philippines. A lifecycle
// rule on the bucket deletes files after 30 days. Returns the object key.
export async function backupDatabase(
  storage: ObjectStorage,
  options: { databaseUrl: string; now?: Date; dump?: (databaseUrl: string) => Promise<Buffer> },
) {
  const body = await (options.dump ?? pgDump)(options.databaseUrl);
  const key = `db/creavent-${manilaDate.format(options.now ?? new Date())}.dump`;
  await storage.put('backups', key, body, 'application/octet-stream');
  return key;
}
