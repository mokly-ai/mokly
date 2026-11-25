# Read workspace layouts from package tsconfig extensions

- **Severity:** High. **Likelihood:** Rare. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-24, from finding 2 on branch `calummoore/mokly-website-redesign-plan-v2-xnnj`.
- **Location:** `packages/mokly/src/sidecar/config-inputs.ts`, `packages/mokly/src/sidecar/workspace-sources.ts`, and `crates/mokly-css/src/workspace_tsconfig.rs`.
- **Reason:** Local layout options cover the reported case. Full inheritance needs dependency lookup and reuse evidence in both readers.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Workspace layout:** The `outDir` and `rootDir` settings that map a package build target to a source file.
  - **Package-name `extends`:** A TypeScript configuration reference such as `@tsconfig/node22/tsconfig.json`.
- **Background:** Mokly renders each comparison side using the sources of that side. It uses both layout folders when both are known and stay inside the package.
- **Problem:** The layout readers follow relative `extends` references in the repository outside `node_modules`. Other references leave both inherited folders unknown. For example, a shared package can supply `outDir: "${configDir}/compiled"` and `rootDir: "${configDir}/authoring"`. Mokly uses the conventional layout when these are the only settings it can inherit.
- **Impact if no action:** A build target in `compiled` can fail to load from a Git base that contains only its source in `authoring`.
- **Root question:** How can Mokly use layout folders inherited from a shared TypeScript configuration?
- **Options:**
  - **A.** Use the current fallback and keep local layout settings. Each package with a custom layout must supply settings that Mokly can read. Effort: Small.
  - **B.** Resolve package names through the side's selected installation. Absolute references and relative references into `node_modules` still use the fallback. Effort: Large.
  - **C.** Share one layout reader across JavaScript and CSS. This requires a new boundary and still needs rules for unreadable references. Effort: Large.
  - **D.** Add lookup for package names, absolute paths, and relative paths into `node_modules` in both readers. Use the side's selected installation and repository mapping. Record files and missing candidates as reuse evidence. Keep the current fallback for references that still cannot be read. Effort: Large.
- **Left out:** Requiring a package build makes the base depend on generated output.
- **Wider fix:** D. Apply one fallback rule to every unreadable reference and honor supported references on the selected side.
- **Previous examples:** `plans/follow-ups/package-tsconfig-extends-reuse.md` records the same lookup gap for the sidecar's TypeScript path settings.
- **Related:** Share a package lookup for `ConfigChain` with `plans/follow-ups/package-tsconfig-extends-reuse.md`. That item covers path evidence. This one covers source layout selection in JavaScript and CSS.
- **Recommendation:** D. It supports inherited layouts and keeps explicit local options.
- **Action:** fix after merge, apply D. The current fallback covers packages that declare both layout folders locally.
- **Done when:** Both readers load an inherited custom layout from the side's selected installation. An edit to an inherited configuration ends stale reuse. The shared `tests/fixtures/workspace-sources.json` cases cover lookup and fallback. Update the layout rule in `docs/protocol/mokly-comparison-packages.md` and its summary in `docs/guides/authoring/config.md`.
