import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const link = {
  id: 1,
  code: 'abc123',
  original_url: 'https://example.com/',
  click_count: 0,
  created_at: '2026-05-19T00:00:00.000Z',
  expires_at: null
};

beforeEach(() => {
  sessionStorage.clear();
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('creates a link and renders the result card', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(link), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    render(<App />);

    await userEvent.type(screen.getByLabelText('原始網址'), 'https://example.com');
    await userEvent.click(screen.getByRole('button', { name: '建立短網址' }));

    const card = await screen.findByTestId('link-card-abc123');
    expect(within(card).getByText('http://localhost:3000/url-shortener/r/abc123')).toBeInTheDocument();
    expect(within(card).getByText('https://example.com/')).toBeInTheDocument();
    expect(sessionStorage.getItem('url-shortener-links')).toBe(JSON.stringify(['abc123']));
  });

  it('restores session links on load', async () => {
    sessionStorage.setItem('url-shortener-links', JSON.stringify(['abc123']));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([link]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    render(<App />);

    expect(await screen.findByTestId('link-card-abc123')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith('/url-shortener/api/links?codes=abc123');
  });

  it('refreshes session stats', async () => {
    sessionStorage.setItem('url-shortener-links', JSON.stringify(['abc123']));
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify([link]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ ...link, click_count: 4 }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

    render(<App />);

    await screen.findByText('0');
    await userEvent.click(screen.getByRole('button', { name: '全部重新整理' }));

    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('deletes a created link', async () => {
    sessionStorage.setItem('url-shortener-links', JSON.stringify(['abc123']));
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify([link]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<App />);

    await screen.findByTestId('link-card-abc123');
    await userEvent.click(screen.getByRole('button', { name: '刪除此連結' }));

    await waitFor(() => {
      expect(screen.queryByTestId('link-card-abc123')).not.toBeInTheDocument();
    });
    expect(sessionStorage.getItem('url-shortener-links')).toBe(JSON.stringify([]));
  });

  it('shows API errors in an alert', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Invalid URL' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    render(<App />);

    await userEvent.type(screen.getByLabelText('原始網址'), 'https://bad.test');
    await userEvent.click(screen.getByRole('button', { name: '建立短網址' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid URL');
  });

  it('submits expiry datetime as ISO string', async () => {
    const selectedExpiry = '2026-05-21T09:30';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(link), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    render(<App />);

    await userEvent.type(screen.getByLabelText('原始網址'), 'https://example.com/with-expiry');
    await userEvent.type(screen.getByLabelText('到期日期與時間 選填'), selectedExpiry);
    await userEvent.click(screen.getByRole('button', { name: '建立短網址' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/url-shortener/api/links',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          original_url: 'https://example.com/with-expiry',
          expires_at: new Date(selectedExpiry).toISOString()
        })
      })
    );
  });

  it('shows success toast on copy and auto hides it', async () => {
    sessionStorage.setItem('url-shortener-links', JSON.stringify(['abc123']));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([link]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    render(<App />);

    await screen.findByTestId('link-card-abc123');
    await userEvent.click(screen.getByRole('button', { name: '複製' }));

    expect(await screen.findByRole('status')).toHaveTextContent('已複製短網址。');

    await waitFor(
      () => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
