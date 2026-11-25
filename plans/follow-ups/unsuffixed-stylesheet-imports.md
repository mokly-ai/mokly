# Load stylesheets reached by unsuffixed JavaScript imports

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from finding 8 on branch `calummoore/mokly-website-redesign-plan-v2-xnnj`.
- **Location:** `packages/mokly/src/sidecar/plugins.ts`, `packages/mokly/src/sidecar/native-resolution.ts`, and `packages/mokly/src/sidecar/bundle-recipe.ts`.
- **Reason:** The same failure occurs on `origin/main` at `10a30afe4`. Workspace source selection changes the file named by the failure.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Stylesheet loader:** The sidecar path that records stylesheet bytes and supplies JavaScript exports for CSS Modules.
- **Background:** Mokly resolves JavaScript imports through esbuild. Its stylesheet hook selects imports whose written name ends in `.css`. A package export or alias can load a stylesheet through a name without that extension.
- **Problem:** Set the alias `theme` to `theme-pkg/styles.css` and import `theme`. If the export resolves to `packages/theme/dist/styles.css`, esbuild loads the CSS without the sidecar recording its bytes. The bundle fails with `Bundled source bytes were not recorded: packages/theme/dist/styles.css`. The same gap affects unsuffixed export keys, CSS Module exports, extensionless relative imports, and a CSS package main field. An installed package's own import can reach it through native resolution.
- **Impact if no action:** The whole bundle fails. Authors can use an import name ending in `.css` when the package or alias permits it.
- **Root question:** How can every JavaScript import that resolves to a stylesheet use Mokly's stylesheet handling?
- **Options:**
  - **A.** Dispatch `.css` files in the general resolve callback. This fixes aliases that reach that callback. Esbuild can also resolve an edge without that callback. Effort: Small.
  - **B.** Dispatch from the resolved file type at a point all native, full, and planned paths reach. The file load hook is one such point. Route the file through the existing stylesheet handling. Keep the `mokly:runtime` import guard for code that the sidecar generates for CSS Modules. Effort: Medium.
  - **C.** Reject stylesheet imports through unsupported paths with the catalogued `consumer graph emitted an undelivered file` error. This needs a protocol change to limit supported CSS imports. Effort: Small.
- **Left out:** Requiring every export key to end in `.css` would restrict an installed package's published API.
- **Wider fix:** B. The same loader serves every route to a stylesheet.
- **Previous examples:** A suffixed alias to the same file already uses the stylesheet loader on `origin/main`.
- **Recommendation:** B. It covers both callback and native resolution paths.
- **Action:** fix after merge, apply B. The dispatch gap predates workspace source selection.
- **Done when:** Unsuffixed package and alias imports deliver stylesheet bytes. An extensionless native import and CSS Module exports use the same handling. Authored imports of reserved runtime paths still fail.
