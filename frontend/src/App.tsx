import { type FormEvent, useEffect, useState, useTransition } from 'react';
import { ApiError, createLink, deleteLink, fetchLinks } from './api';
import { getStoredCodes, removeStoredCode, saveStoredCode, syncStoredCodes } from './storage';
import type { ShortLink } from './types';
import { formatDate, shortUrlForCode } from './utils';

type ToastState = {
  message: string;
  type: 'success' | 'error';
};

function messageForError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return '請求過於頻繁，請稍候一分鐘再試。';
    }
    return error.message;
  }
  return '發生未預期錯誤，請稍後再試。';
}

function sortLinks(links: ShortLink[]) {
  return [...links].sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export default function App() {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [originalUrl, setOriginalUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  function showToast(message: string, type: ToastState['type']) {
    setToast({ message, type });
  }

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
      showToast(messageForError(restoreError), 'error');
    }
  }

  useEffect(() => {
    void restoreLinks();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      showToast('短網址建立成功。', 'success');
    } catch (submitError) {
      showToast(messageForError(submitError), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefreshAll() {
    try {
      const refreshed = await fetchLinks(getStoredCodes());
      syncStoredCodes(new Set(refreshed.map((link) => link.code)));
      startTransition(() => {
        setLinks(sortLinks(refreshed));
      });
      showToast('已重新整理連結資料。', 'success');
    } catch (refreshError) {
      showToast(messageForError(refreshError), 'error');
    }
  }

  async function handleDelete(code: string) {
    try {
      await deleteLink(code);
      removeStoredCode(code);
      startTransition(() => {
        setLinks((currentLinks) => currentLinks.filter((link) => link.code !== code));
      });
      showToast('連結已刪除。', 'success');
    } catch (deleteError) {
      showToast(messageForError(deleteError), 'error');
    }
  }

  async function handleCopy(shortUrl: string) {
    try {
      await navigator.clipboard.writeText(shortUrl);
      showToast('已複製短網址。', 'success');
    } catch (copyError) {
      showToast(messageForError(copyError), 'error');
    }
  }

  return (
    <main className="app-shell">
      <section className="create-panel">
        <div className="app-header">
          <p className="eyebrow">匿名短網址</p>
          <h1>把長網址縮成乾淨好分享的連結。</h1>
          <p>
            不需帳號即可建立短網址，保留本次工作階段的連結，並隨時更新點擊次數。
          </p>
        </div>

        <form className="shorten-form" onSubmit={handleSubmit}>
          <label>
            原始網址
            <input
              type="url"
              required
              value={originalUrl}
              onChange={(event) => setOriginalUrl(event.target.value)}
              placeholder="https://example.com/a/very/long/path"
            />
          </label>

          <label>
            到期日期與時間 <span>選填</span>
            <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </label>

          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? '縮址中...' : '建立短網址'}
          </button>
        </form>
      </section>

      {links.length > 0 ? (
        <section className="links-section" aria-label="已建立連結" aria-busy={isPending}>
          <div className="links-toolbar">
            <h2>本次工作階段連結</h2>
            <button className="secondary-button" type="button" onClick={handleRefreshAll}>
              全部重新整理
            </button>
          </div>

          <div className="links-grid">
            {links.map((link) => {
              const shortUrl = shortUrlForCode(link.code);
              return (
                <article className="link-card" data-testid={`link-card-${link.code}`} key={link.code}>
                  <div className="card-topline">你的短網址</div>
                  <div className="short-url-row">
                    <a href={shortUrl} target="_blank" rel="noreferrer">
                      {shortUrl}
                    </a>
                    <button type="button" onClick={() => handleCopy(shortUrl)}>
                      複製
                    </button>
                  </div>

                  <dl className="stats-grid">
                    <div>
                      <dt>點擊次數</dt>
                      <dd>{link.click_count}</dd>
                    </div>
                    <div>
                      <dt>建立時間</dt>
                      <dd>{formatDate(link.created_at)}</dd>
                    </div>
                    <div>
                      <dt>到期時間</dt>
                      <dd>{link.expires_at ? formatDate(link.expires_at) : '-'}</dd>
                    </div>
                  </dl>

                  <footer className="card-footer">
                    <span>{link.original_url}</span>
                    <button type="button" onClick={() => handleDelete(link.code)}>
                      刪除此連結
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {toast ? (
        <div className={`toast ${toast.type === 'success' ? 'toast--success' : ''}`} role={toast.type === 'error' ? 'alert' : 'status'}>
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}
