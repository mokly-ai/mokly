# A `stories` function in `main.*` fails discovery

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the Milestone 20 documentation pass of the
  branch `calummoore/storybook-track-e-storybook-folders-87sk`.
- **Location:** `packages/mokly/src/sidecar/storybook-main-worker.ts`, which
  reads the `stories` field of `main.*`. `docs/protocol/mokly-root-discovery.md`,
  whose status line names this gap, and whose section "Roots From `main.*`"
  states the final `stories` list.
- **Reason:** Storybook projects seldom write `stories` as a function, and
  the fix needs Storybook's preset loader, which no Mokly code loads yet.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Root without `dir`:** a configuration root that names a Storybook
    folder and no directory. Mokly runs that folder's `main.*` before
    discovery and turns each `stories` entry into a root.
  - **Presets:** Storybook's chain of configuration modules, from the
    framework, the addons, and `main.*`. Storybook applies them in order to
    compute fields such as `stories`.
- **Background:**
  - Decision 20 of the Storybook plan, which the user answered on
    2026-11-20, chose to run `main.*` with Storybook's loader, so that Mokly
    reads every form of `stories`.
  - Design call 13 of that plan says that Mokly loads `main.*` and
    Storybook's presets with Storybook's loaders.
  - Storybook 10.6.2 accepts `stories` as an array, or as a function that
    receives the entries of earlier presets and returns the final list.
  - Mokly reads the `stories` field of the loaded module directly. A
    function value fails discovery with `config-invalid` and "expected a
    stories array".
  - The section "Roots From `main.*`" of
    `docs/protocol/mokly-root-discovery.md` states the end state. A root
    without `dir` takes its directories from the final `stories` list that
    Storybook computes from `main.*` and its presets, and Mokly reads every
    form of `stories`. So the page and the code disagree. A status line below
    the title of that page names the two missing behaviours, a `stories`
    function and the entries that presets add, and links this item.
- **Problem:** A `main.*` whose `stories` is a function, or whose addons add
  `stories` entries through presets, gives Mokly another list than
  Storybook, or fails.
- **Impact if no action:** Such a project must set `dir` and `files` on its
  root, so its globs live in two places.
- **Root question:** How does Mokly get the final `stories` list that
  Storybook computes for a folder?
- **Options:**
  - **A.** Keep the array rule. State it in place of the final-list rule of
    `docs/protocol/mokly-root-discovery.md`, remove the status line of that
    page, and state in the Storybook guide that a root without `dir` needs a
    `stories` array. This drops the user's choice of 2026-11-20 to read every
    form of `stories`, so it needs a user decision. Effort: Small.
  - **B.** Load Storybook's presets for the folder with Storybook's own
    loader, and apply them to get `stories`, as Storybook's CLI does. This
    also covers addons that add entries. A preset that fails to load fails
    discovery with `config-invalid` that names `main.*`. Effort: Medium.
  - **C.** Call a function `stories` with an empty list, without presets.
    Entries that presets add stay out. Effort: Small.
- **Left out:** Parsing `main.*` without running it: decision 20 rejected it.
- **Wider fix:** B, because it reads every form that Storybook reads, also in
  later Storybook versions.
- **Previous examples:** None found.
- **Related:**
  - `plans/follow-ups/storybook-main-selected-path.md`: options that
    conflict. Storybook's `loadAllPresets` selects `main.*` again with
    `getInterpretedFile`. Under the option that item recommends, the preset
    load of B must give the selected `main.*` path to `getPresets`.
  - `plans/follow-ups/storybook-main-read-coverage.md`: the same read
    records. A preset load reads more files, and the coverage rule of that
    item applies to those reads too.
- **Recommendation:** B. It meets decision 20 and design call 13, and it
  gives the same list as Storybook.
- **Action:** fix after merge, apply B, because the form is rare and the
  preset loader is new work outside the milestones of the branch that found
  it.
- **Done when:** Mokly reads a `stories` function and the `stories` entries
  that Storybook presets add, and the status line of
  `docs/protocol/mokly-root-discovery.md` is gone.
