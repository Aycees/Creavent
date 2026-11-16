import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ObjectStorage } from '../files/storage.js';

const run = promisify(execFile);
const manilaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });

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
// image installs it (docs/deployment.md).
async function pgDump(databaseUrl: string) {
  const { args, password } = pgDumpCommand(databaseUrl);
  try {
    const { stdout } = await run('pg_dump', args, {
      encoding: 'buffer',
      maxBuffer: 1024 * 1024 * 1024,
      env: { ...process.env, PGPASSWORD: password },
    });
    return stdout;
  } catch (error) {
    // Only pg_dump's own message: the error also carries the command and env.
    const stderr = (error as { stderr?: Buffer }).stderr?.toString().trim();
    throw new Error(`pg_dump failed: ${stderr || (error as Error).message.split('\n')[0]}`);
  }
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
