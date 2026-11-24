# Align shell breakpoint source claims

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: outside the scope of the F18 review of 2026-10-20.
- **Location:** `packages/viewer/src/shell/layout_breakpoint.ts:10-12`,
  `packages/viewer/src/shell/README.md:456-460`, and
  `packages/ui/src/embedded-layout/embedded-layout.css:164`.
- **Reason:** A viewer review found the false claim in files that its
  change did not touch, so a separate branch corrects it.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **`NARROW_SHELL`:** the media query `(width < 56.25rem)` in
    `layout_breakpoint.ts`, the shell's layout breakpoint at 900px.
- **Background:**
  - Below 900px the shell uses the compact layout: the catalogue and the
    right panel become sheets.
  - The comment of `NARROW_SHELL` in `layout_breakpoint.ts`, at lines 7-13,
    says that every shell and viewer rule and script reads this one query.
    The shell README repeats the claim at lines 456-460.
  - `layout_breakpoint.ts` also exports the 1180px panel step as
    `NARROW_PANELS`. The `@mokly/ui` stylesheets repeat both queries, and
    the viewer's styles test holds them to both. The 560px container query
    has no named constant.
  - `docs/protocol/mokly-shell-device-chrome.md:100-101` names the layout
    breakpoint at 900px and the panel step at 1180px, and
    `docs/protocol/mokly-viewer.md:185-189` names the compact top bar at a
    container width of 560px. So the comment and the README also contradict
    the protocol.
- **Problem:** The claim is false. The floating panels narrow at the 1180px
  panel step: `floating-panel.css`, `panel-tabs.css`, and `shell-layout.css`
  of `@mokly/ui` use `@media (width < 73.75rem)`. The compact top bar and its
  search use the 560px container query of
  `packages/ui/src/embedded-layout/embedded-layout.css:164`.
- **Impact if no action:** A maintainer who trusts the comment can change
  `NARROW_SHELL` and expect every layout to follow, and miss the two other
  widths.
- **Root question:** How should the shell docs describe the widths that
  switch its layouts?
- **Options:**
  - **A.** Narrow the claim in the header and the README: name each width,
    900px, 1180px, and 560px, and what it switches. Effort: Small.
  - **B.** Apply A, and give each width a named constant in one breakpoint
    module that every rule reads. Effort: Medium.
- **Left out:** Making every rule read `NARROW_SHELL` moves the panel step
  and the compact search to 900px, which changes the product's layouts.
- **Wider fix:** None. The `documentation` skill already requires docs that
  match the code.
- **Previous examples:** None found.
- **Recommendation:** A. It corrects the docs without a code
  change.
- **Action:** fix after merge, apply A, because a comment and a
  README that contradict the code are docs drift.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4839).
