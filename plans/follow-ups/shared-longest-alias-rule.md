# Share the longest package alias rule

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #226 and its completed plan, which put the
  problem outside the scope of its review.
- **Location:** `packages/mokly/src/sidecar/dependency-usage.ts:46` and
  line 86, `packages/mokly/src/sidecar/postcss-resolution.ts:95`, and
  `packages/mokly/src/sidecar/style-adapters-plugin.ts:22`.
- **Reason:** The copies are older than PR #226, and the review found them
  outside the diff of that change.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Alias:** an entry of `moduleResolution.aliases` in the configuration.
    It maps a bare package specifier to another bare specifier.
  - **Longest-key rule:** the rule that one import applies only the alias
    with the longest matching key. A key matches the whole specifier or its
    prefix up to a `/`.
- **Background:**
  - `docs/protocol/mokly-configuration.md:185` states that JavaScript and
    CSS apply one longest-key alias substitution.
  - esbuild applies the aliases of the JavaScript compile itself, through
    `resolutionOptions` in `packages/mokly/src/sidecar/resolution.ts:7`.
  - The sidecar also applies the rule in its own code:
    - `resolved` and `resolvedSync` in
      `packages/mokly/src/sidecar/dependency-usage.ts:46` and line 86 each
      hold a copy.
    - `nativePath` in `packages/mokly/src/sidecar/postcss-resolution.ts:95`
      holds a copy for PostCSS.
    - `styleAdaptersPlugin` in
      `packages/mokly/src/sidecar/style-adapters-plugin.ts:22` and line 46
      holds a copy for the style adapters.
  - `packages/mokly/src/sidecar/importer-resolution.ts:26` repeats the
    matching test without the substitution.
- **Problem:** Four inline copies hold one rule. The review of PR #226
  named the copies in `dependency-usage.ts` and `postcss-resolution.ts`.
  The copy in `style-adapters-plugin.ts` and the matching test in
  `importer-resolution.ts` belong to the same class.
- **Impact if no action:** A change of the alias rule can reach only some
  copies. Dependency usage, PostCSS, and the style adapters can then
  resolve one import to different packages.
- **Root question:** How does every part of the sidecar apply one alias rule?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Add one helper, for example `applyAlias` beside `bareSpecifier` in
    `packages/mokly/src/sidecar/specifier.ts`. Use it in the two modules
    that the review named. Effort: Medium (estimate).
  - **C.** Apply B in every copy, also in `style-adapters-plugin.ts`, and
    use its matching test in `importer-resolution.ts`. Effort: Medium
    (estimate).
- **Left out:** A lint that rejects inline alias code. A helper removes the
  copies, and a new lint needs the user.
- **Wider fix:** C (estimate). One helper then holds the rule for every
  caller.
- **Previous examples:** PR #226, merged on 2026-10-28 as `3192b19b`, moved
  the inline copies of the bare-specifier rule into `bareSpecifier` in
  `packages/mokly/src/sidecar/specifier.ts`.
- **Recommendation:** C (estimate). It removes every copy in one change of
  one package.
- **Action:** ask the user, because condition 6 holds (estimate): this is a
  code structure finding.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/esbuild-resolve-fast-path.md?plain=1#L424).
