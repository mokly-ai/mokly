# The plan record key leaves out the Vite flag

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the Milestone 19 documentation pass of the
  branch `calummoore/storybook-track-e-storybook-folders-87sk`.
- **Location:** `crates/mokly-render/src/edit_plans.rs:25-43`,
  `ResolutionSettings`, the key of a kept plan record.
  `docs/protocol/mokly-sidecar-plans.md:81-90`, the rule for that key.
- **Reason:** The mismatch is older than the branch that found it, and that
  branch changes Storybook folders, not plan records.

- **Source:** Implementation.
- **Category:** Docs or spec.
- **Terms:**
  - **Plan record:** the resolution plan of one compile that the core of a
    Serve head keeps, so that a later edit request can reuse it.
  - **Resolution settings:** the key of a plan record.
- **Background:**
  - The protocol page says that the resolution settings are the bundle
    settings without the entry files, the stories files and their Storybook
    folders, the renderer, and the evaluation digest. So the key holds every
    other bundle setting, such as the `vite` flag and the capture setting.
  - The code keys a record only by the module resolution settings, the
    source root, the configuration directory, and the repository roots.
  - The decision on that page says that the key leaves out the settings
    that cannot change the target of a planned import.
- **Problem:** The page and the code name different keys. No test shows
  whether a record made under one value of `vite` can serve an edit request
  under the other value.
- **Impact if no action:** A later change can trust the page and assume that
  a record never crosses a Vite switch, or the code can serve a plan across
  it.
- **Root question:** Which bundle settings can change the target of a planned
  import, and so belong in the key of a plan record?
- **Options:**
  - **A.** Change the page to name the four settings that the code keys by,
    after a check that the `vite` flag and the capture setting cannot change
    an import target of a plan. Effort: Small.
  - **B.** Add the `vite` flag to the key in the code, so that a record never
    crosses a Vite switch. Effort: Small.
  - **C.** Key the record by every bundle setting except the ones that the
    page lists, as the page says. Effort: Small.
- **Left out:** None.
- **Wider fix:** None, because the key has one definition.
- **Previous examples:** None found.
- **Recommendation:** A when the check shows that the Vite adapter sends no
  edit plans, else B. The page then names the key that the code uses.
- **Action:** fix after merge, apply A after the check, because the item is
  outside the scope of the branch that found it.
