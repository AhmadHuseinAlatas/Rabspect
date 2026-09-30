# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`README.MD` section 14 keeps a short project-level changelog covering the design
phase. This file covers the code, in more detail, from v1.0.0 onward.

## [Unreleased]

### Known issues

Three defects found by review, not yet fixed. Tracked in `docs/BACKLOG.md`.

- **No scroll handling in the panel.** New entries arriving below the fold are
  invisible — there is no tail-follow. When the 500-entry ring buffer starts
  trimming from the front, rows are removed above the viewport while `scrollTop`
  stays fixed, so the content jumps.
- **Search rebuilds every haystack on each keystroke.** `passesCommon()` calls
  `entryToLine()` per entry, and the tab counts run it across all seven lenses,
  so a full buffer means roughly 4,000 string constructions per debounce tick.
  Shows up as typing lag exactly when the buffer is large.
- **Arrival animation misfires on tab switch.** `maxRenderedId` only advances
  across filtered rows, so entries that arrived while another tab was selected
  animate as new when you switch back.

## [1.0.0] — 2026-09-30

First working version. Captures console output and network requests from the
active tab and shows them in one panel.

### Added

**Capture layer**

- `console.log / info / warn / error / debug` patched in the MAIN world. An
  isolated content script cannot see the page's `console` object at all, so MAIN
  world is the only route that avoids `chrome.debugger`.
- `fetch` and `XMLHttpRequest.prototype` patched for method, URL, status,
  duration, reported size and request headers. The prototype is patched rather
  than the constructor so `instanceof` and event handlers keep working.
- Uncaught errors, unhandled promise rejections and failed resource loads via
  `addEventListener`, not `window.onerror`, which would overwrite the page's own
  handler.
- Bridge from MAIN world to the service worker over `window.postMessage`,
  batched every 120 ms, with detection of the orphaned-context state that follows
  an extension reload.
- Ring buffer of 500 entries per tab, mirrored to `chrome.storage.session` so the
  panel survives the MV3 service worker idling out.

**Redaction**

- Enforced twice: at capture time inside the page, and again in the service
  worker, which treats page input as untrusted. Functions are idempotent.
- Headers `Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`; fields
  `password`, `token`, `secret`, `apiKey`, `pin`.
- Extended beyond `README.MD` section 11 to **URL query strings** and **object
  arguments to `console.*`**, both realistic leak paths into an exported file.
- `pin` matches exactly rather than as a substring, so `shipping`, `pinned` and
  `spinner` stay readable. Over-eager redaction is its own failure mode.

**Interface**

- Toolbar popup and side panel, both served by one `panel.html` distinguished by
  a query string, so a fix is never applied twice.
- Seven tabs — All, Error, Warn, Info, Log, Debug, Network — each with a live
  count. Implemented as lenses over one stream, keeping `README.MD` sections 2
  and 3 intact.
- Search, `Failed only (status >= 400)`, Clear, Copy as text, Export JSON with a
  warning dialog, dark and light themes, close button with an `Escape` shortcut.
- Three distinct empty states: page not injectable, nothing captured yet, and
  captured but filtered out. The third names the active filters and offers a
  reset, because a blank area with no explanation is how a working tool looks
  broken.
- Network tab explains, when empty, that only `fetch()` and `XMLHttpRequest` are
  hooked. Stylesheets, images, scripts and fonts never pass through them, which is
  why DevTools lists far more rows.

**Assets**

- `icon16/32/48/128.png` generated from the source logo by `tools/make-icons.ps1`,
  which detects the badge automatically, replaces the baked-in checkerboard with
  solid cream and produces genuine alpha transparency. The source file is a JPEG;
  renaming it to `.png` changes nothing.

**Verification**

- `tools/selftest-structure.js` — 22 checks on manifest wiring, the permission
  allowlist, `panel.js` against `panel.html`, colour literals outside the token
  block, and that the icons are real PNGs.
- `tools/selftest-redaction.js` — 46 assertions in both directions.
- `tools/selftest-contrast.js` — WCAG 2.1 ratios plus minimum distance between
  tokens at risk of looking identical.
- `tools/serve.js` — static server over `http://localhost`, needed because a
  `file://` page has an opaque origin and cannot make cross-origin requests.
- `test-page.html` — 14 scenarios that fail on purpose.
- GitHub Actions running all of the above on every push.

### Changed from README.MD

Deviations, each with reasoning in `docs/DECISIONS.md`.

- **Four light-mode colours replaced** because the README's own values fail the
  README's own 4.5:1 rule. `--rp-error` `#D32F27` → `#B3261E`, `--rp-warn`
  `#B58600` → `#8A6100`, `--rp-info` `#0E7C85` → `#0B6C74`, `--rp-success`
  `#1E8E5A` → `#1A7A4D`. `#B58600` is the notable one: the README introduces it
  as the fix for unreadable yellow, and it still only reaches 2.96:1.
- **`--rp-debug` changed** in both themes. The dark value passed contrast at
  7.09:1 but sat 28 away from `--rp-text-muted`, making an active Debug control
  look disabled. Light mode had no value at all. Now `#7EA8DB` and `#3F5A80`.
- **UI placement resolved as popup plus side panel.** `README.MD` section 12 left
  this as an open question.
- **No Lucide icons.** README section 8 mandates them and forbids drawing
  substitutes; without a dependency there is no way to obtain them, so the UI uses
  text labels — which is the style README section 10 asks for anyway.
- **Fonts not bundled.** Inter and JetBrains Mono are named first, then the
  fallback stack the README itself specifies. MV3 forbids remote code and bundling
  fonts adds assets requiring licence review.

### Deliberately not included

Recorded so their absence is not mistaken for oversight. See
`docs/DECISIONS.md` section 6.

- Response bodies, browser-level logs such as CORS and CSP violations, and
  anything needing `chrome.debugger` — deferred to v2 by `README.MD` section 4.
- Requests that are not `fetch` or XHR: `<img>`, `<script>`, `<link>`,
  `sendBeacon`, WebSocket.
- Accurate response size when the server sends no `Content-Length`. Measuring it
  means reading the body, which would break the page under test.
- Cross-session log storage. `chrome.storage.session` is cleared when Chrome
  closes, which is the intended behaviour for data that may contain secrets.

[Unreleased]: https://github.com/AhmadHuseinAlatas/Rabspect/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/AhmadHuseinAlatas/Rabspect/releases/tag/v1.0.0
