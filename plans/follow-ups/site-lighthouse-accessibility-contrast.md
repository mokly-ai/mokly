# Site pages miss the Lighthouse accessibility budget on contrast

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-24, from the branch
  `calummoore/mokly-website-redesign-plan-af84` (PR #488), CI run
  45343539672, job Site Lighthouse.
- **Location:** `apps/site/src/styles/buttons.css` (the filled `.site-button`),
  `packages/ui/src/palette/palette.ts:104` and `:128` (`signalFill`), the home
  demo depiction's `.site-acme-*` rules under `apps/site/src/styles/`,
  `apps/site/src/lighthouse.ts:110` (`SKIPPED_AUDITS`),
  `docs/protocol/mokly-viewer-palette.md:62-70`,
  `docs/protocol/cloud/site-design.md:85-92`
- **Reason:** Part of the cause is a user decision, and Cal chose on
  2026-11-24 to keep it open as a follow-up item.

- **Source:** Implementation.
- **Category:** Accessibility.
- **Terms:**
  - **Filled button:** a button with the `signalFill` green and a white
    label, such as the header's Get started and the home's call to action.
- **Background:**
  - The Lighthouse budget needs an accessibility score of 1 on every audited
    route. Every route scored 0.95 to 0.97 in CI run 45343539672, at 390px
    and 1440px.
  - The only failing audit is `color-contrast`. A local probe on `/` and
    `/pricing/` at 1440px found two causes:
    - The filled button: white on `#109f5c` is 3.42:1. Normal text at 14px
      and 15.5px needs 4.5:1. Decision 4 = A kept this green and accepted
      3:1 for this one pair.
    - The home demo depiction: muted text `#968e89` on white is 3.21:1, and
      `#958a83` on `#2c2622` is 4.43:1, in `.site-acme-lines i` and
      `.site-acme-panel-title`. No decision covers these.
  - On 2026-11-24, Cal asked for rules that make the budget pass for now. The
    budget run leaves out the `color-contrast` audit through `SKIPPED_AUDITS`.
    Every route then scored 1 for accessibility in a local run.
  - The same CI run also missed the performance budget once each on
    `/changelog/` at 390px (0.94) and `/pricing/` at 1440px (0.93). The item
    `flaky-site-lighthouse-performance.md` covers that.
- **Problem:** The budget and decision 4 disagree about the filled button,
  and the demo depiction draws text below 4.5:1.
- **Impact if no action:** No site check measures the contrast of rendered
  text, so a new contrast defect on a page passes unseen. Readers with low vision read the
  button labels and the demo's small muted text with difficulty.
- **Root question:** Which contrast does a filled button and the home demo
  keep, and does the budget accept decision 4?
- **Options:**
  - **A.** Darken the demo's muted text to 4.5:1 on its fills, and keep
    decision 4. Keep the Lighthouse audit out, and add an axe contrast rule
    to the browser check that leaves out only the filled button. Effort:
    Small.
  - **B.** Darken the demo text, and reverse decision 4: `signalFill` becomes
    `#0a8047` (5.01:1 with white) in the palette, the site, the viewer and
    the cloud. Change the two palette pages. Effort: Small.
  - **C.** Darken the demo text, and keep the green with a bold label of at
    least 18.66px, which counts as large text at 3:1. Effort: Medium.
- **Left out:** Lowering the accessibility threshold, because it would also
  hide new contrast defects.
- **Wider fix:** B, because one fill then serves every surface at 4.5:1.
- **Previous examples:** Decision 4 of the Canvas redesign, which
  `docs/protocol/mokly-viewer-palette.md` and
  `docs/protocol/cloud/site-design.md` hold.
- **Recommendation:** B. It meets WCAG AA for every button label, keeps a
  close green, and lets the budget run the audit again. A keeps a known
  contrast gap.
- **Action:** ask the user, because B reverses decision 4 and A adds a check.
