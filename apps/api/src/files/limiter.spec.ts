import { createLimiter } from './process-image.js';

describe('createLimiter', () => {
  it('never runs more than the limit at once, even when new work arrives as a slot frees', async () => {
    const limit = createLimiter(2);
    let running = 0;
    let most = 0;
    const work = () =>
      limit(async () => {
        running += 1;
        most = Math.max(most, running);
        await new Promise((r) => setTimeout(r, 5));
        running -= 1;
      });

    const first = Array.from({ length: 4 }, work);
    await new Promise((r) => setTimeout(r, 6));
    await Promise.all([...first, ...Array.from({ length: 4 }, work)]);

    expect(most).toBe(2);
  });
});
