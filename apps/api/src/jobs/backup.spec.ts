import { Readable } from 'node:stream';
import { backupDatabase, pgDumpCommand, type BackupStore } from './backup.js';

class FakeStore implements BackupStore {
  readonly uploads: { key: string; body: Buffer }[] = [];
  readonly removed: string[] = [];
  async remove(key: string) {
    this.removed.push(key);
  }
  async upload(key: string, body: Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(chunk as Buffer);
    this.uploads.push({ key, body: Buffer.concat(chunks) });
  }
}

// The nightly backup (architecture §9.3): a pg_dump file streamed to the
// backups bucket, named by its date in the Philippines. R2 keeps it 30 days.
describe('backupDatabase', () => {
  it('streams the dump to the backups store under the date in Manila', async () => {
    const store = new FakeStore();
    const dump = vi.fn().mockReturnValue({ stream: Readable.from([Buffer.from('PG'), Buffer.from('DMP')]), done: Promise.resolve() });

    const key = await backupDatabase(store, {
      databaseUrl: 'postgres://u:p@db:5432/creavent',
      now: new Date('2026-11-17T17:30:00Z'),
      dump,
    });

    expect(key).toBe('db/creavent-2026-11-18.dump');
    expect(dump).toHaveBeenCalledWith('postgres://u:p@db:5432/creavent');
    expect(store.uploads).toEqual([{ key, body: Buffer.from('PGDMP') }]);
  });

  it('fails when pg_dump fails, even after the upload took its output', async () => {
    const store = new FakeStore();
    const dump = vi.fn().mockReturnValue({ stream: Readable.from([]), done: Promise.reject(new Error('pg_dump failed: server version mismatch')) });

    await expect(backupDatabase(store, { databaseUrl: 'postgres://x', now: new Date('2026-11-17T17:30:00Z'), dump })).rejects.toThrow('server version mismatch');
    // A cut-off dump isn't left looking like a good one.
    expect(store.removed).toEqual(['db/creavent-2026-11-18.dump']);
  });

  it('dumps in the compressed custom format, without owners or grants, and keeps the password off the command line', () => {
    expect(pgDumpCommand('postgres://u:s3cret@db:5432/creavent?sslmode=require')).toEqual({
      args: ['--format=custom', '--no-owner', '--no-acl', '--dbname=postgres://u@db:5432/creavent?sslmode=require'],
      password: 's3cret',
    });
  });
});
