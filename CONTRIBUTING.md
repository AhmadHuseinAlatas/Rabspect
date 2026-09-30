# Contributing to Rapspect

Read this before your first change. It is short, and it will save you from three
mistakes that are specific to this project.

## Getting it running

There is **no build step and nothing to install.** No `npm install`, no
`package.json`, no bundler. The extension is plain JavaScript, HTML and CSS
loaded as an unpacked folder.

```bash
git clone https://github.com/AhmadHuseinAlatas/Rabspect.git
cd Rabspect
node tools/serve.js          # serves test-page.html on http://localhost:8080
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load
unpacked** → select the folder containing `manifest.json`.

Full walkthrough, including how to read service worker logs and a 95-step manual
verification checklist: [`docs/TESTING.md`](docs/TESTING.md).

## Run the checks before you push

Four commands. They finish in about a second and need no dependencies.

```bash
node tools/selftest-structure.js    # manifest wiring, permissions, panel.js vs panel.html
node tools/selftest-redaction.js    # 46 assertions on the redaction rules
node tools/selftest-contrast.js     # WCAG ratios and token distinctness
node --check src/panel/panel.js     # and any other file you touched
```

CI runs the same four on every push and pull request. If one fails locally it
will fail there too.

## Three project-specific rules

### 1. `README.MD` is the source of truth, and it wins

If your change contradicts something in `README.MD`, that is not automatically a
bug in your change — but it is not something to resolve quietly either. Say so in
the pull request and let the maintainer decide. Several decisions in this codebase
exist specifically because the README ruled one way.

Where the code **does** deviate, the reason is written down in
[`docs/DECISIONS.md`](docs/DECISIONS.md). Four light-mode colours differ from
README section 6 because the README's own 4.5:1 rule fails on the README's own
values. That kind of deviation is acceptable when it is documented and mechanically
verified. Undocumented deviation is not.

### 2. Colours live in one place

Every colour value belongs in the token block at the top of
`src/panel/panel.css`, inside `:root` or `[data-theme="light"]`. Nothing else,
anywhere — including shadows and modal overlays, which have their own tokens
precisely so `rgba(0, 0, 0, 0.4)` cannot creep into the middle of the file.

`selftest-structure.js` parses the stylesheet and fails if a colour literal
appears under any other selector. It determines the boundary from the enclosing
selector rather than a line number, so moving code around will not fool it.

Two further constraints from README section 5 and 6:

- **One colour, one meaning.** Red is always error, yellow always warning, teal
  always info or success. No exceptions.
- **The log area stays boring.** Level colours may touch a row only through the
  level badge and the 3px left edge. Message text is always `--rp-text`. No
  coloured row backgrounds, no gradients, no decorative effects inside a row.

Passing contrast is not enough on its own. `--rp-debug` once passed at 4.91:1 and
still made the UI unusable, because it was byte-identical to the colour of a
disabled control. `selftest-contrast.js` now also enforces a minimum distance
between tokens that risk looking alike. The full story is in `docs/DECISIONS.md`
section 1.6.

### 3. Redaction is not optional, and it is not a detail

If you add a new captured field, it passes through `src/shared/rapspect-core.js`
first. One file holds the rules, loaded by the content script, the service worker
and the panel alike — if the rules were copied, one copy would eventually fall
behind, and the copy that falls behind is the one that leaks a token.

Add an assertion in `tools/selftest-redaction.js` for anything new. Assert both
directions: that the sensitive name is masked, **and** that a similar-looking
ordinary name is not. Over-eager redaction is its own failure, because a log full
of `[REDACTED]` is a log nobody trusts.

## Code style

Matching the existing code matters more than personal preference.

- Vanilla JavaScript. No framework, no transpiler, no ES modules in content
  scripts or the service worker — neither supports `import` in the way this
  project loads them.
- Comments explain **why**, not what. `// increment counter` is noise. `// WeakMap
  rather than a property on the object, so the page cannot see our metadata and so
  entries are collected when the XHR is` is the standard here.
- No `// TODO`. `selftest-structure.js` fails the build on one. Either finish it
  or record it in [`docs/BACKLOG.md`](docs/BACKLOG.md) with enough detail that
  someone else could pick it up cold.
- Handle the failure path. The service worker dies at any moment, a page may be
  impossible to inject, a tab may change URL mid-capture, and reloading the
  extension orphans every content script already in a page. All four are normal
  operating conditions, not edge cases.

## Documentation language

Project documentation under `docs/` is written in **Indonesian**, and UI labels
are in **English**. That split comes from README section 10, not from preference.

Repository infrastructure addressed to outside readers — this file, `SECURITY.md`,
the issue and pull request templates — is in English. Commit messages are in
English.

This split is an open question, tracked as B-07 in `docs/BACKLOG.md`. Changing it
requires correcting README section 10 first.

## Commits and pull requests

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org):
`feat:`, `fix:`, `docs:`, `test:`, `chore:`, with an optional scope such as
`feat(panel):`.

Write the body for someone reading it in six months with no memory of the
conversation. State the symptom, the cause, and what you decided **not** to do.
The existing history is written that way deliberately — `git log` is part of the
documentation here.

In the pull request, be explicit about what you verified and what you could not.
"Checks pass" is not the same as "I loaded it in Chrome and clicked through
V-61 to V-68". Both are useful; conflating them is not.
