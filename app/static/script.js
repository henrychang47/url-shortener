let currentCode = null;
let statsInterval = null;
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
        showResult(data);
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

// ── Result display ────────────────────────────────────────
function showResult(data) {
    currentCode = data.code;

    const shortUrl = `${window.location.origin}/v1/${data.code}`;
    const link = document.getElementById('short-url-link');
    link.href = shortUrl;
    link.textContent = shortUrl;

    updateStats(data);

    document.getElementById('original-url-preview').textContent =
        `→ ${data.original_url}`;

    document.getElementById('result-card').classList.remove('hidden');

    if (statsInterval) clearInterval(statsInterval);
    const capturedCode = data.code;
    statsInterval = setInterval(() => refreshStats(capturedCode), 10000);
}

function updateStats(data) {
    document.getElementById('stat-clicks').textContent = data.click_count;
    document.getElementById('stat-created').textContent = formatDate(data.created_at);
    document.getElementById('stat-expires').textContent =
        data.expires_at ? formatDate(data.expires_at) : '—';
}

async function refreshStats(code) {
    try {
        const res = await fetch(`/v1/links/${code}/stats`);
        if (res.ok && code === currentCode) updateStats(await res.json());
    } catch { /* silent — refresh is best-effort */ }
}

// ── Copy ──────────────────────────────────────────────────
document.getElementById('copy-btn').addEventListener('click', copyToClipboard);

async function copyToClipboard() {
    const link = document.getElementById('short-url-link');
    const btn = document.getElementById('copy-btn');
    try {
        await navigator.clipboard.writeText(link.href);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    } catch {
        showError('Could not copy to clipboard. Please copy the link manually.');
    }
}

// ── Delete ────────────────────────────────────────────────
document.getElementById('delete-btn').addEventListener('click', deleteLink);

async function deleteLink() {
    if (!currentCode) return;
    if (!confirm('Delete this short link? This cannot be undone.')) return;

    try {
        const res = await fetch(`/v1/links/${currentCode}`, { method: 'DELETE' });

        if (res.status === 204) {
            clearInterval(statsInterval);
            statsInterval = null;
            currentCode = null;
            document.getElementById('result-card').classList.add('hidden');
            document.getElementById('url-input').value = '';
            document.getElementById('expiry-input').value = '';
        } else {
            await handleApiError(res);
        }
    } catch {
        showError('Network error. Is the server running?');
    }
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
    return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
    });
}

window.addEventListener('beforeunload', () => clearInterval(statsInterval));