# Marked reuse misses hidden rewrite basenames

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from the independent check of review finding 1 on branch `calummoore/mokly-plan-reuse-editor-files-6dni` at `51c4a8d6b`.
- **Location:** `packages/mokly/src/sidecar/mapped-selection.ts:32`.
- **Reason:** The marked mapping scan is unchanged by the Serve plan candidate work. Its safe reuse miss needs a separate correction.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Marked compilation:** A Serve edit compilation that captures no resolution evidence and can reuse its live input checks in the same process.
  - **Mapped selection:** The association between a configured TypeScript paths target and the file that esbuild selected.
- **Background:** The marked scan keeps evidence for earlier mapping targets that can change the selected module. It recognizes files through exact names, configured extensions, and TypeScript extension rewrites. An unrecognized mapping selection withholds later marked reuse.
- **Problem:** `mappedSelection` chooses rewrites with `path.extname(base)`. An extension-only basename such as `.js` has no Node extension. Esbuild instead matches its `.js` suffix and can select `.ts` or `.tsx`. The scan can fail to associate that selected file with the mapping target.
- **Impact if no action:** An unusual mapped import safely loses later marked reuse. No wrong output was reproduced for this scan.
- **Root question:** How can marked reuse recognize every extension rewrite that esbuild can select for a mapped target?
- **Options:**
  - **A.** Keep the conservative miss. Fresh compilation remains exact but the input continues to lose reuse. Effort: Small.
  - **B.** Match `.js`, `.jsx`, `.mjs`, and `.cjs` suffixes as audited esbuild does. Add the extension-only basename case to a public marked-reuse regression. Preserve the stale-candidate contrast. Effort: Small.
- **Left out:** A guard in the Rust plan reader cannot change this independent marked scan. Sharing a new helper with the plan collector still copies the suffix rule and needlessly couples the two owners. Two approaches suffice for this bounded safe miss.
- **Shared assumptions:** Marked edits still capture and store nothing. Source: the Serve edit rule of `docs/protocol/mokly-sidecar-recipes.md`. The use of Node's extension parser is a code choice. B drops it.
- **Wider fix:** B fixes this bounded suffix derivation. A copied resolver model still requires source audits when esbuild changes.
- **Previous examples:** The same extension parser omitted preferred candidates in the plan collector. Its actual-core probe selected the wrong module until the Serve plan branch corrected the suffix rule.
- **Related:** [marked-package-entry-targets.md](./marked-package-entry-targets.md) uses the same marked scan but concerns an unobserved earlier package entry target. Each correction can merge alone.
  [serve-plan-per-import-evidence.md](./serve-plan-per-import-evidence.md) records the blocked structural alternative for plan admission. It does not replace this marked scan.
- **Recommendation:** B. It preserves exactness and removes the unnecessary reuse miss.
- **Action:** fix after merge, apply B. First reproduce the marked reuse miss through its public boundary. The independent review confirmed the source mismatch but ran no marked scan probe.
