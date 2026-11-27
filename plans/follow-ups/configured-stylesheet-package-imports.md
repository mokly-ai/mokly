# Keep configured stylesheets exact through package imports

- **Severity:** High. **Likelihood:** Rare. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-24, from finding 10 on branch `calummoore/mokly-website-redesign-plan-v2-xnnj`.
- **Location:** `crates/mokly-css/src/workspace_sources.rs`, `crates/mokly-render/src/stylesheets.rs`, `crates/mokly-sidecar/src/methods.rs`, and `packages/mokly/src/sidecar/module-paths.ts`.
- **Reason:** A user can configure the source stylesheet. The complete fix changes the bundle request and both resolvers, and the review had no fix round left for that work.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Configured stylesheet:** A local file named by a `stylesheets`, `lightStylesheets`, or `darkStylesheets` rule.
- **Background:** Mokly delivers a configured stylesheet at its exact path. Package imports of workspace build targets can load corresponding source files. The source-selection rule gives configured files an exact-path exception.
- **Problem:** Neither resolver receives configured stylesheet identities. For example, configure `packages/theme/dist/skin.css` with red text and export that file as `workspace-theme/skin.css`. Its source `src/skin.css` can set blue text. A second stylesheet with `@import "workspace-theme/skin.css"` loads the blue source. An entry's JavaScript import of the same package export also loads the blue source.
- **Impact if no action:** The view can apply the configured build stylesheet and its source in one cascade. If Git omits the configured build file, base validation fails first. Configuring the source file avoids both failures.
- **Root question:** How can CSS and JavaScript imports keep the identity of a configured stylesheet on each side?
- **Options:**
  - **A.** Limit the exact-path exception to configured modules. Package imports of configured stylesheets would continue to substitute sources. Effort: Small.
  - **B.** Supply configured stylesheet identities only to the Rust resolver. CSS `@import` keeps the exact file. JavaScript imports can still substitute the source. Effort: Medium.
  - **C.** Give both resolvers the same canonical configured set from the side's validated configuration. Keep the exact check at their callers. Effort: Large.
  - **D.** Derive all local stylesheet identities from the validated rules of the selected side. Pass them in the bundle request and the Rust resolver's settings. Move the exact check into both source-selection functions. Add a `configured` field to the shared case table. Effort: Large.
- **Left out:** Deduplicating the outputs would still allow a substituted file with different declarations. A warning would also fail strict builds.
- **Wider fix:** D. The shared case table checks the exact-path rule in both languages.
- **Previous examples:** Commit `e53d75db7` protects configured module identities, including package imports of those modules.
- **Related:**
  - `plans/follow-ups/vite-config-request-kind.md`: same rule. Its answer decides which configured files keep their exact path for an import of the Vite config. Under its option B, a configured stylesheet counts for the config only after it enters the Vite setup key. Under its options C and D, both kinds of Vite sidecar call carry the configured set of D here.
  - `plans/follow-ups/workspace-import-resolution-record.md`: shared fix. Its option C holds the exact-path decision of each workspace import on every compile path. D here gives that decision its canonical configured set.
- **Recommendation:** D. It covers CSS and JavaScript with the same canonical configured set.
- **Action:** fix after merge, apply D. The source-path workaround lets the wire change wait for its own review.
- **Done when:** CSS `@import` and JavaScript package imports load the configured build stylesheet at its exact path. Cover both imports and both sides, regenerate the bundle request types, and remove the status line in `docs/protocol/mokly-comparison-packages.md`.
