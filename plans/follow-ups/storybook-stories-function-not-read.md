# A `stories` function in `main.*` fails discovery

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the Milestone 20 documentation pass of the
  branch `calummoore/storybook-track-e-storybook-folders-87sk`.
- **Location:** `packages/mokly/src/sidecar/storybook-main-worker.ts`, which
  reads the `stories` field of `main.*`. `docs/protocol/mokly-root-discovery.md`,
  section "Roots From `main.*`", whose failure rule names a `main.*` without a
  `stories` array.
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
  - Decision 20 of the Storybook plan chose to run `main.*` with Storybook's
    loader, so that Mokly reads every form of `stories`.
  - Design call 13 of that plan says that Mokly loads `main.*` and
    Storybook's presets with Storybook's loaders.
  - Storybook 10.6.2 accepts `stories` as an array, or as a function that
    receives the entries of earlier presets and returns the final list.
  - Mokly reads the `stories` field of the loaded module directly. A
    function value fails discovery with `config-invalid` and "expected a
    stories array".
  - The protocol page states this failure for a `main.*` without a `stories`
    array, so the page and the code agree.
- **Problem:** A `main.*` whose `stories` is a function, or whose addons add
  `stories` entries through presets, gives Mokly another list than
  Storybook, or fails.
- **Impact if no action:** Such a project must set `dir` and `files` on its
  root, so its globs live in two places.
- **Root question:** How does Mokly get the final `stories` list that
  Storybook computes for a folder?
- **Options:**
  - **A.** Keep the array rule, and state in the Storybook guide that a root
    without `dir` needs a `stories` array. Effort: Small.
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
- **Recommendation:** B. It meets decision 20 and design call 13, and it
  gives the same list as Storybook.
- **Action:** fix after merge, apply B, because the form is rare and the
  preset loader is new work outside the milestones of the branch that found
  it.
