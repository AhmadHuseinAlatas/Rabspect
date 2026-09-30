# Summary

<!-- What changes, and why. If it fixes a bug, state the symptom and the cause
     separately — they are rarely the same thing. -->

## Verification

Tick only what you actually ran.

- [ ] `node tools/selftest-structure.js`
- [ ] `node tools/selftest-redaction.js`
- [ ] `node tools/selftest-contrast.js`
- [ ] `node --check` on every JavaScript file I touched
- [ ] Loaded unpacked in Chrome and clicked through the relevant steps in `docs/TESTING.md`

Checklist IDs exercised, if any: <!-- e.g. V-24, V-61 to V-66 -->

**What I could not verify:** <!-- Say so plainly. "Checks pass" and "I used it in
Chrome" are different claims, and conflating them is how regressions ship. -->

## Project rules

- [ ] This does not contradict `README.MD`, **or** the conflict is described below
- [ ] Any new colour lives in the token block at the top of `src/panel/panel.css`, not in the middle of the file
- [ ] Any newly captured field passes through `src/shared/rapspect-core.js`, and has assertions in `selftest-redaction.js` in **both** directions — masked when sensitive, untouched when ordinary
- [ ] No new permission, **or** the justification is added to `docs/DECISIONS.md` section 3.1 stating what breaks without it
- [ ] No `// TODO` left behind; anything unfinished is recorded in `docs/BACKLOG.md` with enough detail to resume cold
- [ ] Comments explain **why**, not what

### README conflict, if any

<!-- README.MD is the source of truth. A conflict does not block the PR, but it
     has to be a visible decision rather than a quiet override. Say which section. -->

## Decisions a reviewer would not guess from the diff

<!-- The things worth the reviewer's attention: an alternative you rejected, a
     trade-off you accepted, a limitation you hit. This section is usually more
     valuable than the diff itself. -->

## Screenshots

<!-- For any visible change, both themes. The log area must stay readable in
     each: level colour belongs on the badge and the left edge only, never on
     the message text (README section 5). -->
