import { backupDatabase, pgDumpArgs } from './backup.js';
import type { Bucket, ObjectStorage } from '../files/storage.js';

class FakeStorage implements Partial<ObjectStorage> {
  readonly puts: { bucket: Bucket; key: string; body: Buffer; contentType: string }[] = [];
  async put(bucket: Bucket, key: string, body: Buffer, contentType: string) {
    this.puts.push({ bucket, key, body, contentType });
  }
}

// The nightly backup (architecture §9.3): a pg_dump file in the backups
// bucket, named by its date in the Philippines. R2 keeps it 30 days.
describe('backupDatabase', () => {
  it('uploads the dump to the backups bucket under the date in Manila', async () => {
    const storage = new FakeStorage();
    const dump = vi.fn().mockResolvedValue(Buffer.from('PGDMP'));

    const key = await backupDatabase(storage as unknown as ObjectStorage, {
      databaseUrl: 'postgres://u:p@db:5432/creavent',
      now: new Date('2026-11-17T17:30:00Z'),
      dump,
    });

    expect(key).toBe('db/creavent-2026-11-18.dump');
    expect(dump).toHaveBeenCalledWith('postgres://u:p@db:5432/creavent');
    expect(storage.puts).toEqual([{ bucket: 'backups', key, body: Buffer.from('PGDMP'), contentType: 'application/octet-stream' }]);
  });

  it('fails without uploading when the dump fails', async () => {
    const storage = new FakeStorage();
    const dump = vi.fn().mockRejectedValue(new Error('pg_dump: server version mismatch'));

    await expect(backupDatabase(storage as unknown as ObjectStorage, { databaseUrl: 'postgres://x', dump })).rejects.toThrow('server version mismatch');
    expect(storage.puts).toHaveLength(0);
  });

  it('dumps in the compressed custom format, without owners or grants, so it restores into a fresh database', () => {
    expect(pgDumpArgs('postgres://u:p@db/creavent')).toEqual(['--format=custom', '--no-owner', '--no-acl', '--dbname=postgres://u:p@db/creavent']);
  });
});
