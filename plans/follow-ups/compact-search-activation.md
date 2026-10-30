# Close compact search after row activation

- **Severity:** Low (estimate). **Likelihood:** Common (estimate). **Effort:** Medium (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  a problem outside the scope of the F9b re-review of 2026-10-20.
- **Location:** `packages/viewer/src/shell/top_bar.tsx:22-30`,
  `packages/viewer/src/viewer/styles.ts:33-47`, and
  `packages/viewer/src/shell/store_filters.ts:27-64`.
- **Reason:** The review found the problem outside its change, and the
  viewer contract does not say what an activation does to an open search.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Embedded viewer:** the `@mokly/viewer` React component that a host
    application renders inside its own page.
  - **Compact search:** the search control of the embedded viewer when its
    top row is 560px wide or less. Activating it opens a search surface over
    the whole row.
  - **Row activation:** a click or Enter on a catalogue row, which opens
    that entry as a new route.
- **Background:**
  - `docs/protocol/mokly-viewer.md:121-127` defines the compact search. The
    open surface covers the row, focuses the input, and keeps both host
    top-bar slots mounted. Close or Escape restores the control and its
    focus. The page says nothing about a row activation.
  - `top_bar.tsx:22` keeps the open state in local React state. Only Escape,
    at line 75, and Close, at line 87, set it to closed.
  - `styles.ts:39-42` places the open surface over the row and hides every
    other top bar child, so the menu button is hidden.
  - On each new route, `withRoute` in `store_filters.ts` closes the
    navigation drawer at line 57 and the tag picker at line 62. It cannot
    close the compact search, because the store does not hold that state.
- **Problem:** After the user opens an entry from a search result, the
  search surface stays open over the top row. The menu button and the host
  slots stay covered until the user presses Close or Escape.
- **Impact if no action:** On a narrow host, a user who opens a result
  cannot reach the navigation menu or the host's top-bar controls without
  an extra step.
- **Root question:** What should the compact search show after the user
  opens an entry from it?
- **Options:**
  - **A.** Close the compact search when the route changes, and keep the
    query. Do not move focus to the search control, which the effect at
    `top_bar.tsx:26-30` does after Close or Escape. Effort: Small.
  - **B.** Keep the search open, but keep the menu button visible on the
    open surface. Effort: Small.
  - **C.** Change nothing. State in `docs/protocol/mokly-viewer.md` that the
    search stays open until Close or Escape. Effort: Small.
  - **D.** Move the open state into the shell store, so that `withRoute`
    resets it with the drawer and the tag picker. Effort: Medium.
- **Left out:** Close the search on every query change. It closes the
  surface while the user types.
- **Wider fix:** D. One store reset then closes every temporary top bar
  surface on a route change, also later ones.
- **Previous examples:** `withRoute` already closes the drawer and the tag
  picker on a route change, at `store_filters.ts:57` and line 62.
- **Related:** [compact-search-focus-test.md](compact-search-focus-test.md)
  asks for a browser test of Close, Escape, focus, and mounted host slots
  of the same control. The test from that item can also cover the option
  chosen here.
- **Recommendation:** D (estimate). It matches the drawer and the tag
  picker, and it covers every route change, not only one row type.
- **Action:** ask the user, because condition 2 holds (estimate): A, B,
  and D add compact search behaviour that the viewer contract does not
  state. No design mockup shows the compact search.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4900).
