import { type FormEvent, useEffect, useState, useTransition } from 'react';
import { ApiError, createLink, deleteLink, fetchLinks } from './api';
import { getStoredCodes, removeStoredCode, saveStoredCode, syncStoredCodes } from './storage';
import type { ShortLink } from './types';
import { formatDate, shortUrlForCode } from './utils';

function messageForError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return 'Too many requests. Please wait a minute and try again.';
    }
    return error.message;
  }
  return 'Unexpected error. Please try again.';
}

function sortLinks(links: ShortLink[]) {
  return [...links].sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export default function App() {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [originalUrl, setOriginalUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function restoreLinks() {
    const codes = getStoredCodes();
    if (codes.length === 0) {
      return;
    }

    try {
      const restored = await fetchLinks(codes);
      syncStoredCodes(new Set(restored.map((link) => link.code)));
      startTransition(() => {
        setLinks(sortLinks(restored));
      });
    } catch (restoreError) {
      setError(messageForError(restoreError));
    }
  }

  useEffect(() => {
    void restoreLinks();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const link = await createLink({
        original_url: originalUrl,
        ...(expiresAt ? { expires_at: new Date(expiresAt).toISOString() } : {})
      });
      saveStoredCode(link.code);
      startTransition(() => {
        setLinks((currentLinks) => sortLinks([link, ...currentLinks.filter((item) => item.code !== link.code)]));
      });
      setOriginalUrl('');
      setExpiresAt('');
    } catch (submitError) {
      setError(messageForError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefreshAll() {
    setError('');
    try {
      const refreshed = await fetchLinks(getStoredCodes());
      syncStoredCodes(new Set(refreshed.map((link) => link.code)));
      startTransition(() => {
        setLinks(sortLinks(refreshed));
      });
    } catch (refreshError) {
      setError(messageForError(refreshError));
    }
  }

  async function handleDelete(code: string) {
    setError('');
    try {
      await deleteLink(code);
      removeStoredCode(code);
      startTransition(() => {
        setLinks((currentLinks) => currentLinks.filter((link) => link.code !== code));
      });
    } catch (deleteError) {
      setError(messageForError(deleteError));
    }
  }

  async function handleCopy(shortUrl: string) {
    await navigator.clipboard.writeText(shortUrl);
  }

  return (
    <main className="app-shell">
      <section className="create-panel">
        <div className="app-header">
          <p className="eyebrow">Anonymous short links</p>
          <h1>Cut long URLs down to a clean route.</h1>
          <p>
            Create temporary links, keep the current session visible, and refresh click counts without an account.
          </p>
        </div>

        <form className="shorten-form" onSubmit={handleSubmit}>
          <label>
            Long URL
            <input
              type="url"
              required
              value={originalUrl}
              onChange={(event) => setOriginalUrl(event.target.value)}
              placeholder="https://example.com/a/very/long/path"
            />
          </label>

          <label>
            Expiry date <span>Optional</span>
            <input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </label>

          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Shortening...' : 'Shorten URL'}
          </button>
        </form>
      </section>

      {links.length > 0 ? (
        <section className="links-section" aria-label="Created links" aria-busy={isPending}>
          <div className="links-toolbar">
            <h2>Session links</h2>
            <button className="secondary-button" type="button" onClick={handleRefreshAll}>
              Refresh All
            </button>
          </div>

          <div className="links-grid">
            {links.map((link) => {
              const shortUrl = shortUrlForCode(link.code);
              return (
                <article className="link-card" data-testid={`link-card-${link.code}`} key={link.code}>
                  <div className="card-topline">Your short link</div>
                  <div className="short-url-row">
                    <a href={shortUrl} target="_blank" rel="noreferrer">
                      {shortUrl}
                    </a>
                    <button type="button" onClick={() => handleCopy(shortUrl)}>
                      Copy
                    </button>
                  </div>

                  <dl className="stats-grid">
                    <div>
                      <dt>Clicks</dt>
                      <dd>{link.click_count}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{formatDate(link.created_at)}</dd>
                    </div>
                    <div>
                      <dt>Expires</dt>
                      <dd>{link.expires_at ? formatDate(link.expires_at) : '-'}</dd>
                    </div>
                  </dl>

                  <footer className="card-footer">
                    <span>{link.original_url}</span>
                    <button type="button" onClick={() => handleDelete(link.code)}>
                      Delete this link
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="toast" role="alert">
          {error}
        </div>
      ) : null}
    </main>
  );
}
