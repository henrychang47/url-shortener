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

// ── Result cards ──────────────────────────────────────────
function addResultCard(data) {
    const shortUrl = `${window.location.origin}/v1/${data.code}`;

    const tpl = document.getElementById('result-card-tpl');
    const card = tpl.content.cloneNode(true).querySelector('.card');

    const link = card.querySelector('.short-url-link');
    link.href = shortUrl;
    link.textContent = shortUrl;

    card.querySelector('.stat-clicks').textContent = data.click_count;
    card.querySelector('.stat-created').textContent = formatDate(data.created_at);
    card.querySelector('.stat-expires').textContent = data.expires_at ? formatDate(data.expires_at) : '—';
    card.querySelector('.original-url-preview').textContent = `→ ${data.original_url}`;

    card.querySelector('.btn-refresh').addEventListener('click', () => refreshStats(data.code, card));

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
            } else {
                await handleApiError(res);
            }
        } catch {
            showError('Network error. Is the server running?');
        }
    });

    const container = document.getElementById('results-container');
    container.insertBefore(card, container.firstChild);
}

async function refreshStats(code, card) {
    try {
        const res = await fetch(`/v1/links/${code}/stats`);
        if (!res.ok) return;
        const data = await res.json();
        card.querySelector('.stat-clicks').textContent = data.click_count;
        card.querySelector('.stat-created').textContent = formatDate(data.created_at);
        card.querySelector('.stat-expires').textContent = data.expires_at ? formatDate(data.expires_at) : '—';
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
