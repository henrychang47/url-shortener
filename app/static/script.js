let toastTimer = null;

// ── Shorten ──────────────────────────────────────────────
document.getElementById('shorten-form').addEventListener('submit', function (e) {
    e.preventDefault();
    shortenUrl();
});

async function shortenUrl() {
    const urlInput = document.getElementById('url-input');
    const expiryInput = document.getElementById('expiry-input');

    const url = urlInput.value.trim();
    if (!url) return;

    setLoading(true);

    try {
        const body = { original_url: url };
        if (expiryInput.value) {
            body.expires_at = new Date(expiryInput.value).toISOString();
        }

        const res = await fetch('/v1/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) { await handleApiError(res); return; }

        const data = await res.json();
        addResultCard(data);
    } catch {
        showError('Network error. Is the server running?');
    } finally {
        setLoading(false);
    }
}

function setLoading(on) {
    const btn = document.getElementById('shorten-btn');
    btn.disabled = on;
    btn.textContent = on ? 'Shortening…' : 'Shorten URL';
}

// ── Session storage ───────────────────────────────────────
const STORAGE_KEY = 'url-shortener-links';

function getStoredCodes() {
    try {
        return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
        return [];
    }
}

function saveLink(data) {
    const codes = getStoredCodes();
    if (codes.includes(data.code)) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...codes, data.code]));
}

function removeStoredLink(code) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(getStoredCodes().filter(c => c !== code)));
}

// ── Result cards ──────────────────────────────────────────
function addResultCard(data) {
    const shortUrl = `${window.location.origin}/v1/${data.code}`;

    const tpl = document.getElementById('result-card-tpl');
    const card = tpl.content.cloneNode(true).querySelector('.card');
    card.dataset.code = data.code;

    const link = card.querySelector('.short-url-link');
    link.href = shortUrl;
    link.textContent = shortUrl;

    card.querySelector('.stat-clicks').textContent = data.click_count;
    card.querySelector('.stat-created').textContent = formatDate(data.created_at);
    card.querySelector('.stat-expires').textContent = data.expires_at ? formatDate(data.expires_at) : '—';
    card.querySelector('.original-url-preview').textContent = `→ ${data.original_url}`;

    card.querySelector('.btn-copy').addEventListener('click', () => {
        const link = card.querySelector('.short-url-link');
        const btn = card.querySelector('.btn-copy');
        navigator.clipboard.writeText(link.href).then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        }).catch(() => {
            showError('Could not copy to clipboard. Please copy the link manually.');
        });
    });

    card.querySelector('.btn-delete').addEventListener('click', async () => {
        if (!confirm('Delete this short link? This cannot be undone.')) return;
        try {
            const res = await fetch(`/v1/links/${data.code}`, { method: 'DELETE' });
            if (res.status === 204) {
                card.remove();
                removeStoredLink(data.code);
                if (container.querySelectorAll('.card[data-code]').length === 0) {
                    document.getElementById('refresh-all-bar').classList.add('hidden');
                }
            } else {
                await handleApiError(res);
            }
        } catch {
            showError('Network error. Is the server running?');
        }
    });

    const container = document.getElementById('results-container');
    container.insertBefore(card, container.firstChild);
    document.getElementById('refresh-all-bar').classList.remove('hidden');
    saveLink(data);
}

async function refreshAllStats() {
    const cards = [...document.querySelectorAll('#results-container .card[data-code]')];
    if (cards.length === 0) return;
    try {
        const params = new URLSearchParams(cards.map(card => ['codes', card.dataset.code]));
        const res = await fetch(`/v1/links?${params}`);
        if (!res.ok) return;
        const links = await res.json();
        const byCode = Object.fromEntries(links.map(l => [l.code, l]));
        for (const card of cards) {
            const data = byCode[card.dataset.code];
            if (!data) continue;
            card.querySelector('.stat-clicks').textContent = data.click_count;
            card.querySelector('.stat-created').textContent = formatDate(data.created_at);
            card.querySelector('.stat-expires').textContent = data.expires_at ? formatDate(data.expires_at) : '—';
        }
    } catch { /* silent — refresh is best-effort */ }
}

// ── Error handling ────────────────────────────────────────
async function handleApiError(res) {
    const map = {
        429: 'Rate limit exceeded. Please wait a moment.',
        422: 'Invalid URL. Please check the format and try again.',
        404: 'Short link not found.',
    };
    if (map[res.status]) { showError(map[res.status]); return; }
    try {
        const body = await res.json();
        showError(body.detail ?? `Unexpected error (${res.status}). Please try again.`);
    } catch {
        showError(`Unexpected error (${res.status}). Please try again.`);
    }
}

function showError(message) {
    const toast = document.getElementById('error-toast');
    toast.textContent = `⚠ ${message}`;
    toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.classList.add('hidden'); toastTimer = null; }, 4000);
}

// ── Utilities ─────────────────────────────────────────────
function formatDate(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// Restore cards saved in this browser session
async function restoreStoredLinks() {
    const codes = getStoredCodes();
    if (codes.length === 0) return;
    try {
        const params = new URLSearchParams(codes.map(c => ['codes', c]));
        const res = await fetch(`/v1/links?${params}`);
        if (!res.ok) return;
        const links = await res.json();
        const returnedCodes = new Set(links.map(l => l.code));
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(codes.filter(c => returnedCodes.has(c))));
        codes.map(c => links.find(l => l.code === c)).filter(Boolean).forEach(addResultCard);
    } catch { /* silent */ }
}

restoreStoredLinks();

document.getElementById('refresh-all-btn').addEventListener('click', () => refreshAllStats());
