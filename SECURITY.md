# Security

Rapspect reads console output and network requests from whatever page you have
open. That makes the security surface unusual for a small extension, so this
document states plainly what it touches, what it never touches, and what it
cannot protect you from.

## What Rapspect captures

- `console.log / info / warn / error / debug` arguments
- uncaught errors, unhandled promise rejections, failed resource loads
- `fetch()` and `XMLHttpRequest`: method, URL, status, duration, reported size,
  **request** headers, and **request** body

## What Rapspect never captures

- **Response bodies.** Not read, not cloned, not buffered. Reading a response
  stream would consume it and break the page under test.
- **Request bodies that are streams, Blobs or ArrayBuffers.** Recorded as
  `[binary body not captured]` for the same reason.
- **Form input.** No listeners are attached to input fields. A password only
  appears if the page itself sends it in a `fetch` or XHR body, and in that case
  it is redacted.
- **Anything outside the active tab.** Buffers are keyed per tab and dropped when
  the tab closes.

## Redaction

Redaction is **always on in v1 and cannot be turned off.**

Masked request headers, matched case-insensitively:

```
Authorization    Cookie    Set-Cookie    X-Api-Key
```

Masked field names, matched after normalising to lowercase alphanumerics, so
`api_key`, `API-KEY` and `apiKey` all match:

```
password    token    secret    apiKey    pin
```

`password`, `token`, `secret` and `apiKey` match as substrings, so
`access_token`, `refreshToken` and `clientSecret` are covered. `pin` matches
exactly, because substring matching would also mask `shipping`, `pinned` and
`spinner` and make the log useless.

Beyond the list above, Rapspect also masks these names in **URL query strings**
and in **object arguments passed to `console.*`**. Both are places a token
realistically leaks into an exported file.

Redaction is enforced twice: at capture time inside the page, before data leaves
it, and again in the service worker before anything enters the buffer. The second
pass exists because a page can forge messages on the bridge; the functions are
idempotent, so running them twice changes nothing.

Verified mechanically by 46 assertions:

```
node tools/selftest-redaction.js
```

Those assertions check both directions: that sensitive names are masked, and that
ordinary names are not.

## Storage

Buffers live in `chrome.storage.session`, which Chrome discards when the browser
closes. Nothing is written to `chrome.storage.local` except your theme choice.
There is no cross-session log storage and no network transmission of captured
data — Rapspect never contacts a server.

## Known limitations you should assume

- **A hostile page can forge log entries.** The bridge uses
  `window.postMessage`, which the page can also post to. The service worker
  treats every entry as untrusted input and validates types, drops unknown fields
  and truncates strings, so the worst case is a fabricated row, not a crash or
  memory exhaustion. Entries are not cryptographically attributable.
- **A page can hide its own logs** by re-patching `console.*` after Rapspect
  does. There is no defence against this without the Chrome DevTools Protocol.
- **Exported files are your responsibility.** Redaction covers known field names.
  It cannot recognise a secret that appears in a field called `note`. Read an
  export before attaching it to a ticket. The export dialog says so, and
  `.gitignore` excludes `rapspect-*.json` so an export cannot be committed by
  accident.

## Permissions, and why each one is requested

| Permission | Why | What breaks without it |
|---|---|---|
| `storage` | mirrors the ring buffer to `chrome.storage.session`; stores the theme | every log disappears whenever the MV3 service worker idles out, with no visible cause |
| `sidePanel` | opens the side panel from the popup | `chrome.sidePanel` is undefined and the button cannot work |
| `tabs` | reads `tab.url` and `tab.title` to label the panel, detect restricted pages, and mark navigations | the panel cannot distinguish "this page produced no logs" from "this page cannot be injected" |

`debugger`, `webRequest`, `scripting`, `activeTab`, `downloads` and
`clipboardWrite` are **not** requested. `tools/selftest-structure.js` fails the
build if a permission appears outside that allowlist, so an accidental addition
cannot ship quietly.

## Reporting a vulnerability

Open a [GitHub issue](https://github.com/AhmadHuseinAlatas/Rabspect/issues) using
the **Bug report** template.

If the issue involves data leaking out of Rapspect — a header or field that
should have been redacted and was not — please **do not attach the affected
export**. Describe the field name and shape instead, for example "a header called
`X-Auth-Token` was captured in full". That is enough to write a failing assertion
against, and it keeps your token out of a public issue.

## Supported versions

| Version | Status |
|---|---|
| 1.0.x | supported |

Requires Chrome 116 or newer. `world: "MAIN"` content scripts need 111,
`chrome.sidePanel` needs 114, and `chrome.sidePanel.open()` needs 116.
