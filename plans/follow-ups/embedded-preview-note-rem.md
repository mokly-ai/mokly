# Make the embedded preview-note width pixel-stable

- **Severity:** Low (estimate). **Likelihood:** Rare (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  a problem outside the scope of the F18 review of 2026-10-20.
- **Location:** `packages/viewer/src/shell/css_previews.ts:68-76`, with the
  width at line 71.
- **Reason:** The review found the rule in a shell stylesheet that its
  change did not edit, so the fix needs a separate branch.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Embedded viewer:** the `@mokly/viewer` React component that a host
    application renders inside its own page.
  - **Preview note:** the centred status text in the preview stage, class
    `mbk-preview-note`.
- **Background:**
  - `packages/viewer/src/shell/previews.tsx:98-108` shows the preview note
    when a side has no capture for the chosen viewport. The text is "No
    previous mobile version was captured. Switch to Desktop to see it."
  - The rule sets `max-width: 24rem` and `font-size: 13px`.
  - A `rem` value follows the root font size of the page. In the embedded
    viewer, the host application owns that page.
- **Problem:** The note width follows the host page's root font size, but
  its text does not. A host with a 10px root font gets a 240px note. A host
  with a 20px root font gets a 480px note. The text stays 13px in both.
- **Impact if no action:** The note wraps into different line breaks in
  each host. With a small root font, it wraps into many short lines.
- **Root question:** How does the preview note keep the same layout in every
  host page?
- **Options:**
  - **A.** Set the width in pixels, `max-width: 384px`. This keeps the
    current width at the default 16px root font. Effort: Small.
  - **B.** Set the width in `em`, relative to the note's own 13px text, for
    example `max-width: 29.5em`. The width then follows the text if its
    size changes later. Effort: Small.
  - **C.** Change nothing. Effort: Small.
  - **D.** Apply B. Add a rule to `packages/viewer/src/shell/README.md`:
    shell widths use `px` or `em`, not `rem`, unless a contract states a
    `rem` value. Effort: Small.
- **Left out:** Change the shell text to `rem` units. It makes more of the
  shell follow the host page, which is the opposite of the goal.
- **Wider fix:** D. The README rule stops new shell widths from following
  the host page. The phone navigation drawer also uses `rem`, at
  `packages/viewer/src/shell/css_nav_search.ts:155`. But
  `docs/protocol/mokly-shell-device-chrome.md:102-103` states that width
  as "max 20rem", so the rule keeps it, and a change there needs a decision
  on that contract.
- **Previous examples:** The embedded compact search switched at `35rem`
  and so moved with the host's root font. It now switches at 560px, in
  `packages/viewer/src/viewer/styles.ts:6-10` and line 33.
  `tests/browser/viewer_layout.spec.ts:128-165` checks it with a 10px and
  a 20px root font.
- **Recommendation:** D (estimate). B removes the host dependence and
  keeps the width tied to its text, and the README rule protects later
  shell styles at no code cost.
- **Action:** fix after merge, apply D (estimate), because it is a small
  product fix in a stylesheet outside the reviewed change.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4844).
