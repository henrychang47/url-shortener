# Frontend/Backend Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React + Vite frontend served by nginx at `/url-shortener/` while keeping FastAPI as an API-only backend with the current anonymous URL shortener behavior.

**Architecture:** The frontend becomes a static Vite build copied into a custom nginx image under `/usr/share/nginx/html/url-shortener`. nginx serves frontend assets and proxies `/url-shortener/api/*` and `/url-shortener/r/*` to the backend's canonical `/api/*` and `/r/*` routes. The backend keeps its current API behavior and no longer owns browser UI assets.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Redis, pytest, React, Vite, TypeScript, Vitest, Testing Library, nginx, Docker Compose, GitHub Actions.

---

## File Structure

Create:

- `frontend/package.json`: frontend scripts and dependencies.
- `frontend/package-lock.json`: npm lockfile generated during implementation.
- `frontend/index.html`: Vite HTML entry.
- `frontend/tsconfig.json`: TypeScript app config.
- `frontend/tsconfig.node.json`: TypeScript config for Vite and Vitest config files.
- `frontend/vite.config.ts`: Vite base path, React plugin, Vitest jsdom setup.
- `frontend/src/main.tsx`: React entrypoint.
- `frontend/src/App.tsx`: top-level UI and workflow state.
- `frontend/src/App.test.tsx`: frontend behavior tests.
- `frontend/src/api.ts`: backend API client.
- `frontend/src/api.test.ts`: API client tests.
- `frontend/src/config.ts`: public base path and API path helpers.
- `frontend/src/setupTests.ts`: Vitest DOM matcher setup.
- `frontend/src/storage.ts`: sessionStorage code persistence.
- `frontend/src/storage.test.ts`: storage tests.
- `frontend/src/styles.css`: frontend styles.
- `frontend/src/types.ts`: shared frontend link type.
- `frontend/src/utils.ts`: date and short URL formatting helpers.
- `frontend/src/utils.test.ts`: helper tests.
- `frontend/Dockerfile`: nginx image that builds and serves the frontend.
- `frontend/.dockerignore`: keep the frontend Docker build context small and deterministic.
- `backend/.dockerignore`: keep the backend Docker build context small and deterministic.

Modify:

- `backend/tests/api/test_links.py`: keep API-only backend assertions and add an explicit legacy static asset 404 assertion.
- `backend/app/core/paths.py`: remove if it remains unused.
- `backend/app/static/index.html`: delete after React app replaces it.
- `backend/app/static/script.js`: delete after React app replaces it.
- `backend/app/static/style.css`: delete after React app replaces it.
- `backend/app/static/404.html`: delete after React app replaces it.
- `nginx/conf.d/default.conf`: serve Vite build assets and proxy prefixed API/redirect paths.
- `compose.yaml`: build the custom frontend nginx image and keep backend built from `backend/`.
- `compose.prod.yaml`: use separate backend and web images.
- `.github/workflows/ci-cd.yaml`: run backend checks from `backend/`, add frontend checks, build and push backend plus web images.
- `.github/scripts/build_ssm_payload.py`: accept backend and web image names and deploy both.
- `README.md`: document split frontend/backend commands, public routes, and deployment shape.

Do not create auth, user ownership, anonymous management token, or QR code files in this phase.

---

### Task 1: Backend API-Only Cleanup

**Files:**
- Modify: `backend/tests/api/test_links.py`
- Delete: `backend/app/core/paths.py`
- Delete: `backend/app/static/index.html`
- Delete: `backend/app/static/script.js`
- Delete: `backend/app/static/style.css`
- Delete: `backend/app/static/404.html`

- [ ] **Step 1: Add a backend static asset regression test**

Add this test method to `TestBackendEntrypoints` in `backend/tests/api/test_links.py`:

```python
    async def test_static_assets_are_not_served_by_backend(self, client: AsyncClient):
        response = await client.get("/static/script.js")
        assert response.status_code == 404
```

- [ ] **Step 2: Run backend entrypoint tests**

Run:

```bash
cd backend
uv run pytest tests/api/test_links.py::TestBackendEntrypoints -v
```

Expected: tests pass. The backend currently does not mount static files, so this regression test should already pass.

- [ ] **Step 3: Remove unused static path helper and backend static assets**

Delete these files:

```text
backend/app/core/paths.py
backend/app/static/index.html
backend/app/static/script.js
backend/app/static/style.css
backend/app/static/404.html
```

Before deleting `backend/app/core/paths.py`, confirm it is unused:

```bash
rg -n "STATIC_DIR|core\.paths" backend
```

Expected: only `backend/app/core/paths.py` is reported.

- [ ] **Step 4: Run backend tests**

Run:

```bash
cd backend
uv run pytest
```

Expected: all backend tests pass.

- [ ] **Step 5: Run backend lint and type checks**

Run:

```bash
cd backend
uv run ruff check .
uv run ruff format --check .
uv run mypy .
```

Expected: all commands pass.

- [ ] **Step 6: Commit backend cleanup**

Run:

```bash
git add backend/tests/api/test_links.py backend/app/core/paths.py backend/app/static
git commit -m "refactor: remove backend static UI assets"
```

---

### Task 2: Frontend Vite Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/setupTests.ts`
- Create: `frontend/src/styles.css`
- Modify: `frontend/README.md`

- [ ] **Step 1: Create frontend package config**

Create `frontend/package.json`:

```json
{
  "name": "url-shortener-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "lint": "tsc -b --pretty false",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0",
    "typescript": "^5.8.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.6.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "^26.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Install frontend dependencies**

Run:

```bash
cd frontend
npm install
```

Expected: `frontend/package-lock.json` is created and dependency installation succeeds.

- [ ] **Step 3: Add Vite and TypeScript config**

Create `frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `frontend/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

Create `frontend/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/url-shortener/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true
  }
});
```

- [ ] **Step 4: Add React entrypoint**

Create `frontend/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>URL Shortener</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `frontend/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Create `frontend/src/setupTests.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Create `frontend/src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <section className="intro-panel">
        <h1>URL Shortener</h1>
        <p>Paste a long URL and get a short, shareable link instantly.</p>
      </section>
    </main>
  );
}
```

Create `frontend/src/styles.css`:

```css
:root {
  color: #151515;
  background: #f4f4f1;
  font-family: "Aptos", "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input {
  font: inherit;
}

.app-shell {
  width: min(1040px, calc(100% - 32px));
  margin: 0 auto;
  padding: 48px 0;
}

.intro-panel {
  max-width: 520px;
}
```

- [ ] **Step 5: Update frontend README**

Replace `frontend/README.md` with:

```markdown
# Frontend Workspace

React + Vite frontend for the URL shortener.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
```

The production app is served under `/url-shortener/`.
```

- [ ] **Step 6: Verify scaffold**

Run:

```bash
cd frontend
npm run lint
npm run test
npm run build
```

Expected: TypeScript check, test command, and production build all pass.

- [ ] **Step 7: Commit scaffold**

Run:

```bash
git add frontend
git commit -m "feat: scaffold react frontend"
```

---

### Task 3: Frontend API, Storage, And Helpers

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/config.ts`
- Create: `frontend/src/api.ts`
- Create: `frontend/src/api.test.ts`
- Create: `frontend/src/storage.ts`
- Create: `frontend/src/storage.test.ts`
- Create: `frontend/src/utils.ts`
- Create: `frontend/src/utils.test.ts`

- [ ] **Step 1: Add shared frontend types**

Create `frontend/src/types.ts`:

```ts
export type ShortLink = {
  id: number;
  code: string;
  original_url: string;
  click_count: number;
  created_at: string;
  expires_at: string | null;
};

export type CreateLinkInput = {
  original_url: string;
  expires_at?: string;
};
```

- [ ] **Step 2: Add path config helpers**

Create `frontend/src/config.ts`:

```ts
export const APP_BASE_PATH = '/url-shortener';
export const API_BASE_PATH = `${APP_BASE_PATH}/api`;

export function apiPath(path: string) {
  return `${API_BASE_PATH}${path}`;
}
```

- [ ] **Step 3: Write API client tests**

Create `frontend/src/api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createLink, deleteLink, fetchLinks } from './api';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api client', () => {
  it('creates links through the prefixed API path', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'abc123' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
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
```

- [ ] **Step 4: Implement API client**

Create `frontend/src/api.ts`:

```ts
import { apiPath } from './config';
import type { CreateLinkInput, ShortLink } from './types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseError(response: Response) {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? `Unexpected error (${response.status}). Please try again.`;
  } catch {
    return `Unexpected error (${response.status}). Please try again.`;
  }
}

async function ensureOk(response: Response) {
  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }
}

export async function createLink(input: CreateLinkInput): Promise<ShortLink> {
  const response = await fetch(apiPath('/links'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  await ensureOk(response);
  return (await response.json()) as ShortLink;
}

export async function fetchLinks(codes: string[]): Promise<ShortLink[]> {
  const params = new URLSearchParams(codes.map((code) => ['codes', code]));
  const query = params.toString();
  const response = await fetch(`${apiPath('/links')}${query ? `?${query}` : ''}`);
  await ensureOk(response);
  return (await response.json()) as ShortLink[];
}

export async function deleteLink(code: string): Promise<void> {
  const response = await fetch(apiPath(`/links/${code}`), { method: 'DELETE' });
  await ensureOk(response);
}
```

- [ ] **Step 5: Add storage tests**

Create `frontend/src/storage.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { getStoredCodes, removeStoredCode, saveStoredCode, syncStoredCodes } from './storage';

beforeEach(() => {
  sessionStorage.clear();
});

describe('link code storage', () => {
  it('stores unique codes in insertion order', () => {
    saveStoredCode('abc123');
    saveStoredCode('abc123');
    saveStoredCode('def456');

    expect(getStoredCodes()).toEqual(['abc123', 'def456']);
  });

  it('removes one stored code', () => {
    saveStoredCode('abc123');
    saveStoredCode('def456');

    removeStoredCode('abc123');

    expect(getStoredCodes()).toEqual(['def456']);
  });

  it('syncs stored codes to returned backend codes', () => {
    saveStoredCode('abc123');
    saveStoredCode('missing');

    syncStoredCodes(new Set(['abc123']));

    expect(getStoredCodes()).toEqual(['abc123']);
  });
});
```

- [ ] **Step 6: Implement storage helpers**

Create `frontend/src/storage.ts`:

```ts
const STORAGE_KEY = 'url-shortener-links';

export function getStoredCodes(): string[] {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredCodes(codes: string[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
}

export function saveStoredCode(code: string) {
  const codes = getStoredCodes();
  if (!codes.includes(code)) {
    writeStoredCodes([...codes, code]);
  }
}

export function removeStoredCode(code: string) {
  writeStoredCodes(getStoredCodes().filter((storedCode) => storedCode !== code));
}

export function syncStoredCodes(existingCodes: Set<string>) {
  writeStoredCodes(getStoredCodes().filter((code) => existingCodes.has(code)));
}
```

- [ ] **Step 7: Add utility tests**

Create `frontend/src/utils.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { formatDate, shortUrlForCode } from './utils';

describe('utils', () => {
  it('formats dates using numeric year month and day', () => {
    expect(formatDate('2026-05-19T00:00:00.000Z')).toMatch(/^2026\/5\/19$/);
  });

  it('builds public short URLs with the /url-shortener/r prefix', () => {
    vi.stubGlobal('location', { origin: 'https://example.test' });

    expect(shortUrlForCode('abc123')).toBe('https://example.test/url-shortener/r/abc123');

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 8: Implement utility helpers**

Create `frontend/src/utils.ts`:

```ts
import { APP_BASE_PATH } from './config';

export function formatDate(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function shortUrlForCode(code: string) {
  return `${window.location.origin}${APP_BASE_PATH}/r/${code}`;
}
```

- [ ] **Step 9: Run frontend unit tests**

Run:

```bash
cd frontend
npm run test
```

Expected: API, storage, and utility tests pass.

- [ ] **Step 10: Commit frontend helpers**

Run:

```bash
git add frontend/src/types.ts frontend/src/config.ts frontend/src/api.ts frontend/src/api.test.ts frontend/src/storage.ts frontend/src/storage.test.ts frontend/src/utils.ts frontend/src/utils.test.ts
git commit -m "feat: add frontend api client helpers"
```

---

### Task 4: React URL Shortener UI

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write app behavior tests**

Create `frontend/src/App.test.tsx`:

```tsx
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

    await userEvent.type(screen.getByLabelText('Long URL'), 'https://example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Shorten URL' }));

    expect(await screen.findByRole('link', { name: /abc123/ })).toHaveAttribute(
      'href',
      'http://localhost:3000/url-shortener/r/abc123'
    );
    expect(screen.getByText('https://example.com/')).toBeInTheDocument();
  });

  it('restores stored links on load', async () => {
    sessionStorage.setItem('url-shortener-links', JSON.stringify(['abc123']));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([link]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    render(<App />);

    expect(await screen.findByRole('link', { name: /abc123/ })).toBeInTheDocument();
  });

  it('refreshes all visible stats', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(link), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ ...link, click_count: 3 }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

    render(<App />);

    await userEvent.type(screen.getByLabelText('Long URL'), 'https://example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Shorten URL' }));
    await screen.findByText('0');
    await userEvent.click(screen.getByRole('button', { name: 'Refresh All' }));

    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith('/url-shortener/api/links?codes=abc123');
  });

  it('deletes a visible link', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(link), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<App />);

    await userEvent.type(screen.getByLabelText('Long URL'), 'https://example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Shorten URL' }));
    const card = await screen.findByTestId('link-card-abc123');

    await userEvent.click(within(card).getByRole('button', { name: 'Delete this link' }));

    await waitFor(() => {
      expect(screen.queryByTestId('link-card-abc123')).not.toBeInTheDocument();
    });
  });

  it('shows mapped API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Invalid URL' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    render(<App />);

    await userEvent.type(screen.getByLabelText('Long URL'), 'bad-url');
    await userEvent.click(screen.getByRole('button', { name: 'Shorten URL' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid URL. Please check the format and try again.'
    );
  });
});
```

- [ ] **Step 2: Run app tests and verify failure**

Run:

```bash
cd frontend
npm run test -- App.test.tsx
```

Expected: tests fail because `App.tsx` does not implement the workflow yet.

- [ ] **Step 3: Implement React workflow**

Replace `frontend/src/App.tsx` with:

```tsx
import { FormEvent, useEffect, useState } from 'react';
import { ApiError, createLink, deleteLink, fetchLinks } from './api';
import { getStoredCodes, removeStoredCode, saveStoredCode, syncStoredCodes } from './storage';
import type { ShortLink } from './types';
import { formatDate, shortUrlForCode } from './utils';

function messageForError(error: unknown) {
  if (error instanceof ApiError) {
    const mapped: Record<number, string> = {
      429: 'Rate limit exceeded. Please wait a moment.',
      422: 'Invalid URL. Please check the format and try again.',
      404: 'Short link not found.'
    };
    return mapped[error.status] ?? error.message;
  }

  return 'Network error. Is the server running?';
}

export default function App() {
  const [url, setUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function restoreStoredLinks() {
      const codes = getStoredCodes();
      if (codes.length === 0) return;

      try {
        const restored = await fetchLinks(codes);
        if (cancelled) return;
        const returnedCodes = new Set(restored.map((link) => link.code));
        syncStoredCodes(returnedCodes);
        setLinks(restored);
      } catch {
        setError('Could not restore links from this browser session.');
      }
    }

    void restoreStoredLinks();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await createLink({
        original_url: trimmedUrl,
        ...(expiresAt ? { expires_at: new Date(expiresAt).toISOString() } : {})
      });
      saveStoredCode(created.code);
      setLinks((current) => [created, ...current.filter((link) => link.code !== created.code)]);
      setUrl('');
      setExpiresAt('');
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefreshAll() {
    const codes = links.map((link) => link.code);
    if (codes.length === 0) return;

    try {
      const refreshed = await fetchLinks(codes);
      const byCode = new Map(refreshed.map((link) => [link.code, link]));
      setLinks((current) => current.map((link) => byCode.get(link.code) ?? link));
    } catch {
      setError('Could not refresh link stats.');
    }
  }

  async function handleDelete(code: string) {
    if (!window.confirm('Delete this short link? This cannot be undone.')) return;

    try {
      await deleteLink(code);
      removeStoredCode(code);
      setLinks((current) => current.filter((link) => link.code !== code));
    } catch (err) {
      setError(messageForError(err));
    }
  }

  async function handleCopy(shortUrl: string) {
    try {
      await navigator.clipboard.writeText(shortUrl);
    } catch {
      setError('Could not copy to clipboard. Please copy the link manually.');
    }
  }

  return (
    <main className="app-shell">
      <section className="create-panel">
        <header className="app-header">
          <p className="eyebrow">Short-link workspace</p>
          <h1>URL Shortener</h1>
          <p>Paste a long URL and keep the useful links from this browser session close at hand.</p>
        </header>

        <form className="shorten-form" onSubmit={handleSubmit}>
          <label>
            Long URL
            <input
              required
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/your/very/long/url"
            />
          </label>

          <label>
            Expiry date <span>(optional)</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </label>

          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Shortening...' : 'Shorten URL'}
          </button>
        </form>
      </section>

      {links.length > 0 ? (
        <section className="links-section" aria-label="Created links">
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
```

- [ ] **Step 4: Replace frontend styles**

Replace `frontend/src/styles.css` with:

```css
:root {
  color: #171717;
  background:
    linear-gradient(135deg, rgba(31, 77, 84, 0.12), transparent 36%),
    linear-gradient(315deg, rgba(156, 91, 58, 0.14), transparent 30%),
    #f4f4f1;
  font-family: "Aptos", "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

.app-shell {
  width: min(1100px, calc(100% - 32px));
  margin: 0 auto;
  padding: 48px 0;
}

.create-panel {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(320px, 1.1fr);
  gap: 32px;
  align-items: start;
  margin-bottom: 28px;
}

.app-header {
  padding-top: 8px;
}

.eyebrow {
  margin: 0 0 10px;
  color: #2f6268;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 12px;
  font-size: clamp(2rem, 5vw, 4.5rem);
  line-height: 0.95;
}

h2 {
  margin-bottom: 0;
  font-size: 1rem;
}

.app-header p:last-child {
  max-width: 420px;
  color: #5f625e;
  line-height: 1.6;
}

.shorten-form,
.link-card {
  border: 1px solid rgba(23, 23, 23, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 16px 40px rgba(23, 23, 23, 0.08);
}

.shorten-form {
  display: grid;
  gap: 16px;
  padding: 24px;
}

label {
  display: grid;
  gap: 8px;
  color: #373a36;
  font-size: 0.9rem;
  font-weight: 700;
}

label span {
  color: #81847f;
  font-weight: 500;
}

input {
  min-width: 0;
  width: 100%;
  border: 1px solid #c8cac3;
  border-radius: 6px;
  padding: 11px 12px;
  color: #171717;
  background: #fff;
}

input:focus {
  border-color: #1f4d54;
  outline: 2px solid rgba(31, 77, 84, 0.2);
}

.primary-button,
.secondary-button,
.short-url-row button {
  border: 0;
  border-radius: 6px;
  font-weight: 700;
}

.primary-button {
  min-height: 44px;
  color: #fff;
  background: #1f4d54;
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.secondary-button,
.short-url-row button {
  padding: 8px 12px;
  color: #263331;
  background: #e4e7df;
}

.links-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 14px;
}

.link-card {
  min-width: 0;
  padding: 20px;
}

.card-topline {
  margin-bottom: 10px;
  color: #81847f;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.short-url-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.short-url-row a {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #171717;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 18px 0 0;
  padding-top: 16px;
  border-top: 1px solid rgba(23, 23, 23, 0.08);
}

.stats-grid div {
  min-width: 0;
}

dt {
  color: #81847f;
  font-size: 0.72rem;
}

dd {
  margin: 4px 0 0;
  font-size: 1.15rem;
  font-weight: 800;
}

.card-footer {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(23, 23, 23, 0.08);
}

.card-footer span {
  min-width: 0;
  overflow: hidden;
  color: #6f726d;
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-footer button {
  flex: 0 0 auto;
  border: 0;
  color: #b3261e;
  background: transparent;
}

.toast {
  position: fixed;
  right: 16px;
  bottom: 16px;
  max-width: min(420px, calc(100% - 32px));
  border: 1px solid #efb8b4;
  border-radius: 8px;
  padding: 12px 14px;
  color: #8c1d18;
  background: #fff1f0;
  box-shadow: 0 12px 30px rgba(23, 23, 23, 0.14);
}

@media (max-width: 760px) {
  .app-shell {
    padding: 28px 0;
  }

  .create-panel {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .links-toolbar,
  .card-footer {
    align-items: stretch;
    flex-direction: column;
  }
}
```

- [ ] **Step 5: Run app tests**

Run:

```bash
cd frontend
npm run test -- App.test.tsx
```

Expected: app behavior tests pass.

- [ ] **Step 6: Run full frontend checks**

Run:

```bash
cd frontend
npm run lint
npm run test
npm run build
```

Expected: TypeScript, Vitest, and Vite build pass.

- [ ] **Step 7: Commit React UI**

Run:

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/styles.css
git commit -m "feat: build react url shortener ui"
```

---

### Task 5: nginx Routing And Local Compose

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/.dockerignore`
- Create: `backend/.dockerignore`
- Modify: `nginx/conf.d/default.conf`
- Modify: `compose.yaml`

- [ ] **Step 1: Add frontend nginx Dockerfile**

Create `frontend/Dockerfile`:

```dockerfile
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json tsconfig.node.json vite.config.ts ./
COPY src src/
RUN npm run build

FROM nginx:1-alpine

COPY --from=build /app/dist/ /usr/share/nginx/html/url-shortener/
```

- [ ] **Step 2: Add Docker ignore rules**

Create `frontend/.dockerignore`:

```gitignore
.git
.env
node_modules
dist
coverage
```

Create `backend/.dockerignore`:

```gitignore
.git
.env
.venv
__pycache__
.pytest_cache
.mypy_cache
.ruff_cache
```

- [ ] **Step 3: Replace nginx routing config**

Replace `nginx/conf.d/default.conf` with:

```nginx
server {
    listen 80;

    root /usr/share/nginx/html;

    location = /health {
        access_log off;
        return 200 "healthy\n";
    }

    location = /backend-health {
        proxy_pass http://backend:8000/health;
        access_log off;
    }

    location /url-shortener/api/ {
        proxy_pass http://backend:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /url-shortener/r/ {
        proxy_pass http://backend:8000/r/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /url-shortener {
        return 308 /url-shortener/;
    }

    location /url-shortener/ {
        try_files $uri $uri/ /url-shortener/index.html;
    }
}
```

- [ ] **Step 4: Update local compose nginx service**

In `compose.yaml`, change the `nginx` service to build the frontend image and mount only nginx config:

```yaml
  nginx:
    build:
      context: ./frontend
    volumes:
      - type: bind
        source: ./nginx/conf.d
        target: /etc/nginx/conf.d
    ports:
      - 80:80
    healthcheck:
      test: [ "CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/health" ]
      interval: 1m
      timeout: 20s
      retries: 3
      start_period: 10s
    depends_on:
      - backend
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 128M
```

Keep the existing `backend`, `migrate`, `postgres-db`, and `redis` service definitions unchanged except for formatting performed by Docker Compose.

- [ ] **Step 5: Validate nginx config through Docker Compose**

Run:

```bash
docker compose build nginx
docker compose run --rm nginx nginx -t
```

Expected: nginx image builds and `nginx -t` reports successful syntax validation.

- [ ] **Step 6: Commit routing changes**

Run:

```bash
git add frontend/Dockerfile frontend/.dockerignore backend/.dockerignore nginx/conf.d/default.conf compose.yaml
git commit -m "feat: serve frontend through nginx"
```

---

### Task 6: Production Compose And CI/CD

**Files:**
- Modify: `compose.prod.yaml`
- Modify: `.github/workflows/ci-cd.yaml`
- Modify: `.github/scripts/build_ssm_payload.py`

- [ ] **Step 1: Update production compose image variables**

In `compose.prod.yaml`, set nginx to the frontend web image and backend/migrate to the backend image:

```yaml
services:
  nginx:
    image: ${WEB_IMAGE?Variable not set}
    ports:
      - 80:80
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/health"]
      interval: 1m
      timeout: 20s
      retries: 3
      start_period: 10s
    depends_on:
      - backend
    deploy:
      resources:
        limits:
          cpus: '0.15'
          memory: 48M

  backend:
    image: ${BACKEND_IMAGE?Variable not set}
```

Also change the `migrate` service image to:

```yaml
  migrate:
    image: ${BACKEND_IMAGE?Variable not set}
```

Keep database, redis, and Cloudflare tunnel behavior unchanged.

- [ ] **Step 2: Update SSM payload script arguments**

Change `.github/scripts/build_ssm_payload.py` argument parsing to:

```python
    parser.add_argument("--backend-image", required=True)
    parser.add_argument("--web-image", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--compose-prod", required=True)
    parser.add_argument("--nginx-conf", required=True)
```

Change the environment export commands in the same file to:

```python
            f"export BACKEND_IMAGE='{args.backend_image}'",
            f"export WEB_IMAGE='{args.web_image}'",
```

Change the compose pull command to:

```python
            "docker compose --env-file .env -f compose.prod.yaml pull backend migrate nginx cloudflare-tunnel",
```

The rest of the deploy command sequence remains the same.

- [ ] **Step 3: Update workflow environment image names**

In `.github/workflows/ci-cd.yaml`, replace the image env block with:

```yaml
env:
  AWS_REGION: ap-southeast-2
  GHCR_BACKEND_IMAGE: ghcr.io/henrychang47/url-shortener-backend
  GHCR_WEB_IMAGE: ghcr.io/henrychang47/url-shortener-web
```

- [ ] **Step 4: Fix backend CI working directories**

In backend lint/type/test jobs, add `working-directory: backend` to all `uv` commands:

```yaml
      - name: Install dependencies
        working-directory: backend
        run: uv sync --group dev

      - name: Ruff lint check
        working-directory: backend
        run: uv run ruff check .

      - name: Ruff format check
        working-directory: backend
        run: uv run ruff format --check .

      - name: Mypy type check
        working-directory: backend
        run: uv run mypy .
```

Apply the same `working-directory: backend` setting to test job steps that run `uv sync`, `uv run alembic upgrade head`, `uv run alembic check`, and `uv run pytest`.

- [ ] **Step 5: Add frontend CI job**

Add this job after backend lint/type check:

```yaml
  frontend-check:
    name: Frontend Build & Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v6

      - name: Set up Node
        uses: actions/setup-node@v5
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Type check
        working-directory: frontend
        run: npm run lint

      - name: Test
        working-directory: frontend
        run: npm run test

      - name: Build
        working-directory: frontend
        run: npm run build
```

Change the backend `test` job dependency to:

```yaml
    needs: [lint-and-type-check, frontend-check]
```

- [ ] **Step 6: Build and push separate backend and web images**

Replace the deploy build step with two Docker build-push steps:

```yaml
      - name: Build and push backend image
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          push: true
          tags: |
            ${{ env.GHCR_BACKEND_IMAGE }}:${{ github.sha }}
            ${{ env.GHCR_BACKEND_IMAGE }}:latest

      - name: Build and push web image
        uses: docker/build-push-action@v6
        with:
          context: ./frontend
          push: true
          tags: |
            ${{ env.GHCR_WEB_IMAGE }}:${{ github.sha }}
            ${{ env.GHCR_WEB_IMAGE }}:latest
```

- [ ] **Step 7: Update SSM payload workflow invocation**

Replace the build payload command with:

```bash
python3 .github/scripts/build_ssm_payload.py \
  --backend-image "${GHCR_BACKEND_IMAGE}:${GITHUB_SHA}" \
  --web-image "${GHCR_WEB_IMAGE}:${GITHUB_SHA}" \
  --output ssm-parameters.json \
  --compose-prod compose.prod.yaml \
  --nginx-conf nginx/conf.d/default.conf
```

- [ ] **Step 8: Run script syntax check**

Run:

```bash
python -m py_compile .github/scripts/build_ssm_payload.py
```

Expected: command exits successfully.

- [ ] **Step 9: Commit CI/CD changes**

Run:

```bash
git add compose.prod.yaml .github/workflows/ci-cd.yaml .github/scripts/build_ssm_payload.py
git commit -m "ci: build backend and frontend images"
```

---

### Task 7: Documentation And Final Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README architecture and API sections**

Update README to state:

```markdown
The repository is split into `backend/` and `frontend/` workspaces. nginx serves the React frontend at `/url-shortener/` and proxies API plus redirect traffic to FastAPI.
```

Update public routes to include:

```markdown
| Method | Public Endpoint | Backend Endpoint | Description |
|--------|-----------------|------------------|-------------|
| `GET` | `/url-shortener/` | static frontend | React app |
| `POST` | `/url-shortener/api/links` | `/api/links` | Create a short link |
| `GET` | `/url-shortener/r/{code}` | `/r/{code}` | Redirect to original URL |
| `GET` | `/url-shortener/api/links` | `/api/links` | List links |
| `GET` | `/url-shortener/api/links/{code}/stats` | `/api/links/{code}/stats` | Get link stats |
| `DELETE` | `/url-shortener/api/links/{code}` | `/api/links/{code}` | Delete a link |
```

- [ ] **Step 2: Update README local commands**

Add:

```markdown
## Frontend Development

```bash
cd frontend
npm install
npm run dev
```

## Backend Development

```bash
cd backend
uv run pytest
uv run ruff check .
uv run mypy .
```

## Full Stack With nginx

```bash
docker compose up --build
```

The full stack is available at `http://localhost/url-shortener/`.
```

- [ ] **Step 3: Run backend verification**

Run:

```bash
cd backend
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run mypy .
```

Expected: all backend checks pass.

- [ ] **Step 4: Run frontend verification**

Run:

```bash
cd frontend
npm run lint
npm run test
npm run build
```

Expected: all frontend checks pass.

- [ ] **Step 5: Run Docker build verification**

Run:

```bash
docker compose build backend nginx
```

Expected: backend and nginx images build.

- [ ] **Step 6: Run nginx syntax verification**

Run:

```bash
docker compose run --rm nginx nginx -t
```

Expected: nginx config syntax is valid.

- [ ] **Step 7: Run full stack smoke test**

Run:

```bash
docker compose up -d --build
```

Then verify:

```bash
curl --fail http://localhost/health
curl --fail http://localhost/backend-health
curl --fail http://localhost/url-shortener/
curl --fail -X POST http://localhost/url-shortener/api/links \
  -H "Content-Type: application/json" \
  -d "{\"original_url\":\"https://example.com\"}"
```

Expected:

- `/health` returns `healthy`.
- `/backend-health` returns backend health JSON.
- `/url-shortener/` returns the React HTML shell.
- `POST /url-shortener/api/links` returns `201` with a JSON body containing `code`.

- [ ] **Step 8: Verify new redirect path manually**

Use the code from the previous response:

```bash
curl -I http://localhost/url-shortener/r/<code>
```

Expected: response is `302` with `Location: https://example.com/`.

- [ ] **Step 9: Verify legacy redirect is unsupported**

Run:

```bash
curl -I http://localhost/url-shortener/<code>
```

Expected: response is not a backend redirect. It should return the React app fallback status instead of `302`.

- [ ] **Step 10: Commit docs and verification updates**

Run:

```bash
git add README.md
git commit -m "docs: document frontend backend split"
```

---

## Final Review Checklist

- [ ] Phase 1 preserves anonymous create, list, stats refresh, copy, delete, expiry input, and session restore.
- [ ] New short URLs use `/url-shortener/r/{code}`.
- [ ] `/url-shortener/{code}` is not supported as a redirect.
- [ ] FastAPI does not serve frontend static assets.
- [ ] nginx serves React assets and proxies API/redirect paths before SPA fallback.
- [ ] Backend checks pass from `backend/`.
- [ ] Frontend checks pass from `frontend/`.
- [ ] Docker Compose build and nginx syntax validation pass.
- [ ] README matches the new workspace and routing model.
