import { cleanName } from './clean-name.js';

// Names that come from somewhere other than our forms, like a Google
// profile, are cleaned rather than refused.
describe('cleanName', () => {
  it('removes hidden characters and extra spaces', () => {
    expect(cleanName('  Maria‮  Santos​ ')).toBe('Maria Santos');
  });

  it('cuts a name to 100 characters', () => {
    expect(cleanName('x'.repeat(150))).toHaveLength(100);
  });
});
