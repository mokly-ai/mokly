# An esbuild evaluation failure names every entry

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: the finding checks of
  findings 111 and 140 put it outside the scope.
- **Location:** `packages/mokly/src/sidecar/evaluate.ts:72` to line 75, and
  the esbuild options at `packages/mokly/src/sidecar/bundle-options.ts:66`.
- **Reason:** The message predates the Vite adapter work of the branch that
  found it.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Esbuild path:** Mokly's default compile path, which bundles the
    catalogue's JavaScript with esbuild.
- **Background:**
  - `docs/protocol/mokly-sidecar-definitions.md:52` says that a module
    evaluation failure keeps `bundle-failed` with the module and the
    diagnostic text. `docs/protocol/mokly-sidecar.md:131` asks for the source
    and the diagnostic of an evaluation failure.
  - On the esbuild path, `describe` evaluates the generation as one bundle
    through `new Function`, at `packages/mokly/src/sidecar/evaluate.ts:52`.
    The bundle has no module boundary and no source map, at
    `packages/mokly/src/sidecar/bundle-options.ts:66` to line 80.
  - When the evaluation throws, the message lists every entry file, stories
    file, and renderer before the error text, at lines 72 to 75 of
    `evaluate.ts`. The message is older than the Vite adapter.
  - The branch that found this item gives the Vite path an evaluation message
    that names the module that threw, or a fixed evaluation label when no
    module threw.
- **Problem:** An esbuild evaluation failure names every entry, stories file,
  and renderer, not the module that threw.
- **Impact if no action:** In a large catalogue, a long list comes before the
  error text, and the author must search for the file that failed.
- **Root question:** How does an esbuild evaluation failure name the module
  that threw?
- **Options:**
  - **A.** Build the esbuild bundle with a source map, and map the first
    stack frame inside the bundle to its source file. Name the logical path
    of that file. Keep the list when no frame maps. Test a throw in a helper
    of the second entry. Cost: the compiled recipe and the bundle cache hold
    the map, and the stack parse depends on the frame text of V8. Effort:
    Medium.
  - **B.** Give the esbuild path the evaluation message form of the Vite
    path, with a fixed evaluation label in place of the list. Cost: it names
    no module, so it does not meet the rule that asks for the module.
    Effort: Small.
- **Left out:**
  - Name the failing entry. The bundle evaluates every entry in one
    function, so no boundary tells the entries apart.
  - Map a frame to the nearest source comment of the bundle. A is better on
    every point, because a source map is a supported format, and the
    comments change with the bundle options.
- **Wider fix:** A. A source map lets each evaluation error, from any module,
  name its file.
- **Previous examples:** commit `b741db86d` fixed the same message for a
  failure while `describe` collects the definitions: it now names the failing
  module.
- **Related:** commit `b741db86d` names the failing module in a `describe`
  failure. Use the same message form here. That fix knows the module in its
  collection loop. This item needs the source map of A.
- **Recommendation:** A. It names the module that the rule asks for, and it
  keeps the list as the fallback.
- **Action:** fix after merge, apply A, because the message predates the Vite
  adapter work of the branch that found it.
