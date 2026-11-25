# Virtual modules show as the entry module

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: a new problem that the
  finding check of finding 140 found.
- **Location:** `packages/mokly/src/sidecar/vite-urls.ts:53`,
  `packages/mokly/src/sidecar/vite-errors.ts:131`, and the section "Module
  Graph" of `docs/protocol/mokly-vite-adapter.md`.
- **Reason:** It is a Rare diagnostic defect, and the build error itself stays
  intact.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript
    through the project's own Vite setup.
  - **Virtual module:** A module that a plugin serves without a file, such
    as `virtual:icons`.
  - **Virtual entry:** Mokly's own virtual module, which exports every entry
    module, stories file, the renderer, and the Storybook preview.
- **Background:**
  - `docs/protocol/mokly-vite-adapter.md:161` says that the diagnostic of a
    transform or resolution failure names the logical module, the plugin,
    and the plugin's message. No Vite diagnostic shows an absolute path or a
    virtual module.
  - `viteName` names each id without a file "entry module", at
    `packages/mokly/src/sidecar/vite-urls.ts:53`.
  - `viteDetail` puts the same words in place of each virtual id in a
    message, such as an id that starts with `\0`, `virtual:`, `mokly:`, or
    `/@id/`, at `packages/mokly/src/sidecar/vite-errors.ts:131`.
  - The branch that found this item gives Vite evaluation errors their own
    message, which reads no `id` field of a thrown value. That message keeps
    the rewrite of `viteDetail`.
- **Problem:** A failure in the virtual module of a plugin, or a message that
  names one, says "entry module". The author then looks at Mokly's virtual
  entry, which did not fail.
- **Impact if no action:** The author can look for the error in the wrong
  place.
- **Root question:** How does a Vite diagnostic name a virtual module that is
  not Mokly's virtual entry, with no virtual id in the text?
- **Options:**
  - **A.** Name a virtual module that is not Mokly's virtual entry with a
    fixed label, such as "a virtual module", and add the plugin name when
    the error gives one. Keep "entry module" only for Mokly's virtual entry.
    Test a failing `virtual:` module of a setup plugin. Effort: Small.
  - **B.** Name the importer of the virtual module, which the author can
    open, beside the fixed label. Cost: the error path needs the importer of
    each virtual id. Effort: Medium.
  - **C.** Show the plugin's own virtual id without its `\0` prefix, such as
    `virtual:icons`. Cost: it changes the rule that no Vite diagnostic shows
    a virtual module, so the user decides. Effort: Small.
- **Left out:** None.
- **Wider fix:** A. One label rule for each id without a file, in `viteName`
  and in `viteDetail`, keeps each message from naming a module that did not
  fail.
- **Previous examples:** The branch that found this item removed the
  first-entry fallback of Vite evaluation errors on 2026-11-25.
  `plans/follow-ups/vite-setup-error-location.md` records the same class for
  setup errors.
- **Recommendation:** A. It removes the false name at Small effort, and it
  keeps the rule against virtual ids in diagnostics.
- **Action:** fix after merge, apply A, because it is a Rare diagnostic
  defect, and the build error itself stays intact.
