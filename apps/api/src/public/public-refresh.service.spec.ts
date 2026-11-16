import { PublicRefreshService } from './public-refresh.service.js';

describe('PublicRefreshService (decision Q1)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('WEB_URL', 'http://web.test');
    vi.stubEnv('REVALIDATE_SECRET', 's3cret');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('posts each tag once to the web app with the shared secret', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await new PublicRefreshService().refresh(['listing', 'event:1', 'listing']);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://web.test/internal/revalidate',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ tags: ['listing', 'event:1'] }) }),
    );
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ 'x-revalidate-secret': 's3cret' });
  });

  it('asks nothing without a secret or tags', async () => {
    vi.stubEnv('REVALIDATE_SECRET', '');
    await new PublicRefreshService().refresh(['listing']);
    vi.stubEnv('REVALIDATE_SECRET', 's3cret');
    await new PublicRefreshService().refresh([]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws when the web app is down', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(new PublicRefreshService().refresh(['listing'])).resolves.toBeUndefined();
  });
});
