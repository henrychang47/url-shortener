import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createLink, deleteLink, fetchLinks } from './api';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api client', () => {
  it('creates links through the prefixed API path', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          code: 'abc123',
          original_url: 'https://example.com/',
          click_count: 0,
          created_at: '2026-05-19T00:00:00.000Z',
          expires_at: null
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    );

    await createLink({ original_url: 'https://example.com' });

    expect(fetchMock).toHaveBeenCalledWith('/url-shortener/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original_url: 'https://example.com' })
    });
  });

  it('fetches links with repeated code query params', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await fetchLinks(['abc123', 'def456']);

    expect(fetchMock).toHaveBeenCalledWith('/url-shortener/api/links?codes=abc123&codes=def456');
  });

  it('deletes links through the prefixed API path', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));

    await deleteLink('abc123');

    expect(fetchMock).toHaveBeenCalledWith('/url-shortener/api/links/abc123', {
      method: 'DELETE'
    });
  });

  it('raises ApiError with response status and message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Invalid URL' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await expect(createLink({ original_url: 'bad' })).rejects.toMatchObject({
      status: 422,
      message: 'Invalid URL'
    } satisfies Partial<ApiError>);
  });
});
