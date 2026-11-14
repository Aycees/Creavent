import { describeLink, socialLinksSchema } from '@creavent/shared';

const parse = (link: string) => socialLinksSchema.safeParse([link]);

// Links that organizers and vendors submit, which admins open and profiles
// show. They must not be able to disguise where they go.
describe('social links', () => {
  it.each([
    ['facebook.com/bazaarngmintal', 'https://facebook.com/bazaarngmintal'],
    ['  https://www.instagram.com/lolas  ', 'https://www.instagram.com/lolas'],
    ['HTTPS://Facebook.com/Page', 'https://facebook.com/Page'],
    ['tiktok.com/@lolasukay', 'https://tiktok.com/@lolasukay'],
  ])('accepts %s and stores it as %s', (input, stored) => {
    const res = parse(input);
    expect(res.success).toBe(true);
    expect(res.data).toEqual([stored]);
  });

  it.each([
    ['a script link', 'javascript:alert(1)'],
    ['a data link', 'data:text/html,<script>alert(1)</script>'],
    ['another scheme', 'ftp://files.example.com'],
    ['a username before the host', 'https://facebook.com@evil.com'],
    ['a username and password', 'https://user:pass@evil.com'],
    ['a right-to-left override', 'https://evil.com/‮moc.koobecaf'],
    ['a zero-width character', 'https://face​book.com'],
    ['a NUL byte', 'https://evil.com\u0000'],
    ['an IP address', 'http://169.254.169.254/latest'],
    ['an IPv6 address', 'http://[::1]:3000'],
    ['a hex IP', 'http://0x7f000001'],
    ['a host with no dot', 'http://localhost:3000'],
    ['a very long link', `https://example.com/${'a'.repeat(2100)}`],
  ])('refuses %s', (_, input) => {
    expect(parse(input).success).toBe(false);
  });

  it('shows the real host of a lookalike, in punycode', () => {
    expect(describeLink('https://fаcebook.com/page')).toMatchObject({ host: 'xn--fcebook-2fg.com', known: false });
  });

  it('marks well-known social sites and shows the rest of the link', () => {
    expect(describeLink('https://www.facebook.com/bazaar/posts/1')).toEqual({
      host: 'www.facebook.com',
      rest: '/bazaar/posts/1',
      known: true,
    });
    expect(describeLink('https://facebook.com.evil.example/page')).toMatchObject({ host: 'facebook.com.evil.example', known: false });
  });
});
