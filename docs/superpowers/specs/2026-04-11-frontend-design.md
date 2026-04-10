# Frontend Interface — Design Spec

**Date:** 2026-04-11  
**Status:** Approved

## Summary

A single-page frontend served directly by FastAPI that demonstrates all four API endpoints of the URL shortener. Minimal/clean aesthetic, pure HTML + CSS + vanilla JS, no build step.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Tech stack | Vanilla HTML/CSS/JS | No build step, served as a static file by FastAPI |
| Visual style | Minimal / Clean | White background, subtle greys, single dark accent |
| API integration | Live calls | Demonstrates real functionality, not a mockup |
| Layout | Centered Hero | Single-column, top-to-bottom flow; most focused UX |
| Feature scope | Full | Shorten, copy, stats, delete |

## Architecture

```
app/
  static/
    index.html        ← single file: all HTML, CSS, JS inline
main.py               ← add StaticFiles mount + CORS middleware
```

The frontend is a single self-contained `index.html` file. No external JS frameworks, no npm. FastAPI serves it via `StaticFiles` at `/`. CORS middleware is added to allow browser requests to the API from the same origin.

## UI Sections

### Header
- Title: "🔗 URL Shortener"
- Subtitle: "Paste a long URL and get a short, shareable link instantly."
- Centered, above the form card.

### Form Card
- **Long URL input** (`<input type="url">`) — required. Browser-native URL validation before submitting.
- **Expiry date picker** (`<input type="datetime-local">`) — optional. Maps to `expires_at` in the API.
- **Shorten URL button** — calls `POST /links`. Shows a loading spinner on the button while in flight.

### Result Card (shown after successful shorten)
Appears below the form after a successful response. Contains:
- **Short link** — displayed as a clickable anchor (`href` opens in new tab).
- **Copy button** — writes the short URL to the clipboard. Briefly changes to "Copied!" on success.
- **Stats grid** — three cells: Clicks / Created / Expires. Populated from the `POST /links` response; auto-refreshes every 10 seconds via `GET /links/{code}/stats`.
- **Delete button** — calls `DELETE /links/{code}`. On success, hides the result card and resets the form.
- **Original URL preview** — truncated display of the destination URL as footer text.

### Error Toast
- Shown for API errors: 429 (rate limit), 422 (invalid URL), 404 (not found), and network failures.
- Red-tinted banner with an icon and a human-readable message.
- Auto-dismisses after 4 seconds.

## API Calls

| Action | Endpoint | Method | Notes |
|---|---|---|---|
| Shorten | `/v1/links` | POST | Body: `{original_url, expires_at?}` · returns 201 |
| View stats | `/v1/links/{code}/stats` | GET | Polled every 10s while result card is visible |
| Delete | `/v1/links/{code}` | DELETE | Hides result card on 204 |
| Redirect | `/v1/{code}` | GET | Native browser navigation, no JS needed |

## Backend Changes

### `main.py`
1. Add `CORSMiddleware` allowing all origins (or `http://localhost` for dev).
2. Mount `StaticFiles` at `/` serving `app/static/`, with `html=True` so `index.html` is served at root.

```python
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/", StaticFiles(directory="app/static", html=True), name="static")
```

> **Note:** The `StaticFiles` mount must come **after** `app.include_router(links.router)`, otherwise it intercepts API routes.

## States & Interactions

| State | Trigger | UI behaviour |
|---|---|---|
| Idle | Page load | Form visible, result card hidden |
| Loading | Shorten clicked | Button disabled + spinner, inputs disabled |
| Success | 200 from POST /links | Result card appears below form |
| Copy success | Copy clicked | Button text → "Copied!" for 1.5s |
| Stats refresh | Every 10s | Click count updates silently |
| Delete confirm | Delete clicked | Confirm dialog; on confirm → DELETE call |
| Deleted | 204 from DELETE | Result card fades out, form resets |
| Error | Non-2xx response | Error toast shown, loading state cleared |

## Out of Scope

- Authentication / user accounts
- Link history across sessions (no localStorage persistence)
- QR code generation
- Custom short codes
- Mobile-specific optimisation (responsive layout only)
