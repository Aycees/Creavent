import { createLockout } from './auth.js';

describe('sign-in lockout', () => {
  it('locks an email after the maximum failed tries', () => {
    const lockout = createLockout(2, 60_000, 10);

    expect(lockout.tryStart('a@x.com')).toBe(true);
    expect(lockout.tryStart('a@x.com')).toBe(true);
    expect(lockout.tryStart('a@x.com')).toBe(false);
  });

  it('keeps a locked email locked when the store fills up with other emails', () => {
    const lockout = createLockout(2, 60_000, 3);
    lockout.tryStart('victim@x.com');
    lockout.tryStart('victim@x.com');

    for (let i = 0; i < 20; i += 1) lockout.tryStart(`junk${i}@x.com`);

    expect(lockout.tryStart('victim@x.com')).toBe(false);
  });

  it('forgets tries once the window has passed', () => {
    vi.useFakeTimers();
    const lockout = createLockout(1, 60_000, 10);
    lockout.tryStart('a@x.com');
    expect(lockout.tryStart('a@x.com')).toBe(false);

    vi.advanceTimersByTime(61_000);

    expect(lockout.tryStart('a@x.com')).toBe(true);
    vi.useRealTimers();
  });
});
