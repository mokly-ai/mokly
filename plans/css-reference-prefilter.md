# Skip CSS reference scans of text without references

Status: Active. On branch `calummoore/css-reference-prefilter`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says.

Serve and `build` walk the resource closure of every rendered document, and
the comparison walks it again for both sides. The walk scans each inline
`style` attribute and each `<style>` element for CSS references with
`mokly_css::syntax::references`, which tokenizes the whole text with
`cssparser`. A CPU profile of Serve on the `mokly-cloud` catalogue (1,508
views, many inline styles from React Native Web) on 2026-11-16 put about 13%
of the core's CPU in that scan, most of it in `Tokens::new`. Almost no inline
style holds a reference. The evidence is in `.context/css-reference-prefilter/`.

The change adds a byte-level prefilter at the start of `references`: text
that holds no backslash and no ASCII case-insensitive `url`, `import`, or
`image-set` returns no references without tokenizing. The result is exact.
A `url()` function or an unquoted URL needs the letters `url`, an `@import`
prelude needs `import`, and a quoted image-set candidate needs `image-set`
(also inside `-webkit-image-set`), unless a CSS escape spells a letter, and
every CSS escape starts with a backslash. The change does not alter any
reference result, any caller, or any protocol rule.

Decisions:

- 2026-11-16, user: keep optimising the speed and the reliability of Changes,
  merge without asking, and make no change that can exhaust a machine's
  memory. This approves the plan and the merge.
- 2026-11-16, my call: the prefilter lives in `references` itself, so every
  caller gains and no caller can skip it. Rejected: a prefilter in the
  graph's closure walk only, because the stylesheet paths call the same scan.
- 2026-11-16, my call: a backslash anywhere sends the text to the tokenizer,
  so escaped names stay exact without decoding escapes in the prefilter.

Contract owners: none. No protocol page states how references are scanned.
The [mokly-css README](../crates/mokly-css/README.md) gets one sentence if it
describes the scan.

## Milestone 1: Prefilter

Depends on: none

- [ ] Add the prefilter to `crates/mokly-css/src/syntax.rs`, with no
      allocation and no change to the result.
- [ ] Unit tests: for each case below, `references` gives the same result as
      the tokenizer path. Show that a prefilter which ignores backslashes
      fails the escape case.
  - `url(a.png)` and `URL(a.png)`
  - `u\72l(a.png)`
  - `@import "a.css";` and `@IMPORT url(a.css);`
  - `image-set("a.png" 1x)` and `-webkit-image-set('a.png' 2x)`
  - a comment that holds `url(`
  - text with no reference, and an empty text
- [ ] Run `cargo test -p mokly-css` and `cargo test -p mokly-graph`.

## Milestone 2: Measurement

Depends on: 1

- [ ] Release builds of `main` and of the branch. On `mokly-cloud`, a build
      with Changes and a Serve run with one edit, before and after. Record the
      times and the share of `syntax::references` in a CPU profile under
      `.context/css-reference-prefilter/`.

## Milestone 3: Verification, commit, review, and pull request

Depends on: 1, 2

- [ ] Run the targeted tests, the early check, and the repository suite named
      in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
