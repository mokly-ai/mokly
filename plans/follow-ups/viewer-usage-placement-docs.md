# Align the documented location of Used by

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #223 and its completed plan, which put the
  problem outside the scope of its review.
- **Location:** `docs/protocol/mokly-viewer.md:101`,
  `packages/viewer/docs/concepts/README.md:114`, and
  `docs/protocol/mokly-component-explorer.md:97`.
- **Reason:** The two viewer pages placed Used by in Details before PR #223,
  and the review found the conflict outside the diff of that change.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Used by list:** the `workspace.usedBy` list of an entry detail. It
    names the screens and components that use a component.
  - **Details and Usage panels:** two inspector panels of the Browse shell.
    Details shows the entry's metadata. Usage shows its Used by and Affected
    lists.
- **Background:**
  - The component pages contract at
    `docs/protocol/mokly-component-explorer.md:97` says that Usage contains
    the Used by screens and components.
  - The shell renders the Used by list in the Usage panel, through
    `UsageSection` in `packages/viewer/src/shell/workspace_usage.tsx:65`.
  - The Details panel has its own "Used by" row in
    `packages/viewer/src/shell/details_rows.tsx:145`. That row lists the use
    cases that include the entry, not the Used by list.
  - `docs/protocol/mokly-viewer.md:101` says that Details show the workspace
    of the entry detail: Used by, Affected screens, related changed
    components, and input changes.
  - `packages/viewer/docs/concepts/README.md:114` says the same of the
    Details panel.
- **Problem:** The viewer contract and the viewer concepts README place the
  Used by list in Details. The component pages contract and the shell place
  it in Usage.
- **Impact if no action:** An embedding host or a contributor reads the
  wrong panel for the list. A test or a host change written from the viewer
  pages can then check the wrong panel.
- **Root question:** Which panel holds the Used by list, and do all pages say
  the same?
- **Options:**
  - **A.** Correct `docs/protocol/mokly-viewer.md` and
    `packages/viewer/docs/concepts/README.md`, so that they place the Used by
    and Affected lists in Usage, as the component pages contract does.
    Effort: Small.
  - **B.** Move the Used by list into the Details panel of the shell, and
    correct the component pages contract. Effort: Medium (estimate).
  - **C.** Change nothing. Effort: Small.
- **Left out:** None. The options cover each side of the conflict and no
  change.
- **Wider fix:** None. The `documentation` skill already says that the side
  that is wrong changes.
- **Previous examples:** None found.
- **Recommendation:** A (estimate). The shell and the component pages
  contract agree, so only the two viewer pages are wrong.
- **Action:** fix after merge, apply A (estimate), because the two pages
  contradict the product, and A changes only their words.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/usage-list-in-parent-detail.md?plain=1#L386).
