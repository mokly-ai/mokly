# ESLint config uses deprecated tseslint.config()

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-31, from [PR #74](https://github.com/mokly-ai/mokly-cloud/pull/74), post-push review 2, outside the scope.
- **Location:** `eslint.config.js:22`.
- **Reason:** The deprecated helper still works with the installed packages, and the review scope of PR #74 was the lint scope only.
- **Checked:** 2026-11-17, in this repository after the cloud moved in. The merged root `eslint.config.js` lints Mokly and the cloud, and it still builds its configuration with `tseslint.config(...)`. The Mokly configuration before the move used the same helper.
- **Category:** Code structure.

- **Terms:**
  - **`tseslint.config()`:** A helper of the `typescript-eslint` package. It builds the flat ESLint configuration array from config objects.
  - **`defineConfig()`:** The ESLint core helper with the same purpose. ESLint exports it from `eslint/config`, which resolves to `node_modules/eslint/lib/config-api.js`.
- **Background:**
  - The root `eslint.config.js` builds its configuration with `tseslint.config(...)` at line 22.
  - The root `package.json` declares `typescript-eslint` `^8.71.1` and `eslint` `^10.12.0`. The lockfile installs 8.71.1 and 10.12.0.
  - In `node_modules/typescript-eslint/dist/config-helper.d.ts`, the declaration of `config` carries this note at line 67: "@deprecated ESLint core now provides this functionality via `defineConfig()`, which we now recommend instead."
  - `eslint.config.js` already imports `includeIgnoreFile` from `eslint/config` at line 4. That module also exports `defineConfig`.
- **Problem:** The root ESLint configuration depends on a helper that its own package marks as deprecated.
- **Impact if no action:** A later major release of `typescript-eslint` can remove the helper. The lint then fails to load until somebody migrates the file.
- **Root question:** Which helper builds the root ESLint configuration?
- **Options:**
  - **A.** Change nothing until a release removes the helper. Effort: Small.
  - **B.** Import `defineConfig` from `eslint/config`, and replace `tseslint.config(` with `defineConfig(`. Keep `...tseslint.configs.recommended` as it is. Check that `npm run lint` reads the same files as before and reports no problem. Effort: Small.
- **Left out:** A plain exported array with no helper. It loses the type support and the flattening of nested arrays that both helpers give, so option B is better on every point.
- **Wider fix:** None. No other file in the repository calls `tseslint.config()`.
- **Previous examples:** None found.
- **Recommendation:** B. It is a two-line change to the helper that both packages recommend.
- **Action:** ask the user, because condition 6 holds: the finding is about code structure, and the review-fix rule sends such findings to the user.
