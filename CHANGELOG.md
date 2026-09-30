# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`README.MD` section 14 keeps a short project-level changelog covering the design
phase. This file covers the code, in more detail, from v1.0.0 onward.

## [Unreleased]

### Fixed

All three defects listed here previously are now closed.

- **Scroll handling in the panel.** There was none at all. Two behaviours now,
  and the distinction is the point: if you are at the bottom you are following
  the stream, so the view stays pinned there as DevTools console does. If you are
  reading higher up, your position is held — including compensating for rows the
  ring buffer removes from above the viewport, which previously shifted the line
  you were reading out from under the cursor. A `jump to latest` pill appears when
  entries arrive below the fold, because otherwise nothing tells you they did.
- **Search no longer rebuilds every haystack per keystroke.** `passesCommon()`
  called `entryToLine()` per entry and the tab counts ran it across all seven
  lenses, so a full buffer meant roughly 4,000 string constructions per debounce
  tick. Now cached by entry id, pruned when the buffer trims and cleared on
  snapshot. Safe to cache because entries are immutable once stored.
- **Arrival animation no longer misfires on tab switch.** `maxRenderedId` only
  advanced across filtered rows, so sitting on the Error tab while log entries
  streamed in meant switching back to All animated dozens of old rows as new. The
  threshold is now computed over all entries and passed into the row builder
  rather than read from state that has already moved on.

### Added

Six features. The v1 scope in README section 4 was already complete, so these come
from README section 13's roadmap plus three small wins against the workflow in
section 2. Reasoning in `docs/DECISIONS.md` section 2.6d.

- **Markdown and Jira export**, roadmap v2.1, brought forward because it is the
  most direct answer to README section 2's second problem: copying evidence into a
  bug report is slow and manual. Nobody pastes raw JSON into a ticket. The export
  dialog now has a format picker, Markdown by default, and a **Copy** button beside
  **Download** — the clipboard is the path actually used.

  Two characters break a table silently: a pipe splits a column and a newline ends
  the row early, and stack traces contain both. In Jira `{` also opens a macro. So
  escaping differs by context, deliberately: braces are **not** escaped in Markdown
  cells because Markdown gives them no meaning, and **not** escaped inside
  `{noformat}` because that content is shown literally and a stray backslash would
  be visible in the ticket. Stack traces are wrapped in `<details>` so a ticket does
  not balloon. Jira uses `{noformat}` rather than `{code}`, which guesses the
  language and can mis-colour a stack trace.

- **Pause capture**, roadmap v1.1. It freezes the **view**, not capture. Entries
  keep arriving and are kept; only rendering is held. The alternative — stopping
  capture to keep the ring buffer clean — was rejected on one ground: evidence not
  captured cannot be recovered, a held view can. The `PAUSED` badge carries the
  number of held entries, because a frozen panel and a broken panel look identical
  from the outside.

- **Configurable redaction**, roadmap v1.1, **additive only**. Extra field names
  can be added; the built-in list can never be switched off. An off switch would
  put a token leak one click away from someone rushing to file a ticket, and a
  leaked token cannot be recalled once it is in a public repository. Names shorter
  than three characters are rejected for the same reason `pin` is matched exactly:
  they would match almost everything and make the log useless. Applied in the
  service worker, because capture runs in the MAIN world which has no `chrome.*`
  access at all.

- **Grouping of repeated identical entries**, consecutive only. Grouping
  non-adjacent entries would scramble chronology, which is the point of reading a
  log. This protects the 500-entry budget: a page throwing the same error 200 times
  spends 40% of the buffer on one piece of information. The row shows the **first**
  occurrence time; the last is in the details block, because showing the last makes
  the time column appear to jump.

- **Copy a single row.** Often only one line is wanted, and selecting it with a
  cursor in a 400px panel is irritating.

- **Remembered preferences**: tab, failed-only, grouping, extra redaction fields.
  Deliberately **not** remembered: the search text, because a panel opening with a
  stale filter looks like a panel that lost data, and the paused state, because
  opening frozen is the fastest way to conclude capture is broken.

- **`tools/selftest-report.js`** — 49 checks. The most useful one is not that the
  report looks tidy but that **every Markdown table row has the same number of
  column separators**, which is what catches an unescaped pipe without pasting into
  a real ticket. Its first run failed twice, and both were faults in my assertions
  rather than the code: the fixture had no braces in a table cell so Jira escaping
  was never exercised, and I expected `session_id` not to match the extra field
  `sessionId` when normalisation strips the underscore and makes them the same.

- **Syntax colouring inside log rows**, with the constraint that made it
  admissible under README section 5: it marks structure, not decoration. Two new
  hues only, fully separate from the level palette, so "one colour, one meaning"
  survives. File paths and URLs in one colour, `line:column` in another, stack
  trace scaffolding (`at`, brackets) deliberately dimmed rather than coloured, and
  error type names distinguished by weight because red already means level.
  `selftest-contrast.js` now tests every syntax colour against every semantic
  colour — nearest actual distance is 44 against a threshold of 25.
- **`tools/selftest-highlight.js`** — 39 checks. The property under test is not
  that colours are right but that tokenising never loses a character: a
  miscoloured log is obvious, a log missing a digit from a line number is trusted
  and wrong. It found two real bugs on first run: a bare `Error` never matched
  because the pattern required a prefix, and `data:` could never match because it
  has no `//`. Also covers markup passing through unchanged, since tokens are
  written with `textContent` and the panel is an extension page with full
  `chrome.*` access.
- **`tools/selftest-structure.js` extended** to require the two new syntax tokens
  in both themes.
- **`.github/dependabot.yml`** — monthly updates for the two pinned GitHub
  Actions. There are no application dependencies to watch; the workflow is the
  only thing that can rot.

### Changed

- `core.tokenizeLog()` moved into `src/shared/rapspect-core.js`. It was written in
  `panel.js` first, which made pure string logic impossible to test without a
  browser. The panel now only translates tokens into DOM nodes.
- `formatTime`, `formatBytes`, `tagFor` and `entryToLine` moved to
  `rapspect-core.js` for the same reason, alongside the new report builders.
- `Export JSON` is now just `Export`, since the format is chosen in the dialog.
- `.gitignore` covers `rapspect-*.md` and `rapspect-*.txt` as well as `.json`, so
  the new export formats cannot be committed by accident either.

### Not done, and deliberately

- **No per-token animation**, although it was requested. Moving text is harder to
  read, and this is where README section 5's ban on decorative effects inside log
  rows applies without needing interpretation. Motion went into the app skin
  instead: the `jump to latest` pill slides in.

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
