import { R2Storage } from './storage.js';

describe('R2Storage', () => {
  const original = process.env.R2_PUBLIC_URL;
  afterEach(() => {
    process.env.R2_PUBLIC_URL = original;
  });

  it('builds public addresses even when the setting has stray spaces or a trailing slash', () => {
    process.env.R2_PUBLIC_URL = ' https://pub-abc.r2.dev/   ';

    expect(new R2Storage().publicUrl('avatar/1.webp')).toBe('https://pub-abc.r2.dev/avatar/1.webp');
  });
});
