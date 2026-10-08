# Test Helper Export Ratchet

Continuation of [Repository Verification Ratchets](./verification-ratchets.md).

## Delivery Status

The test helper export ratchet is implemented. The existing
unused-internal-export scope, baseline, findings, and summary stay unchanged.

## Candidate Modules

Scan `tests/` and `packages/viewer/tests/` recursively. A candidate is a regular
file under either root with one of these extensions: `.ts`, `.tsx`, `.mts`,
`.cts`, `.js`, `.mjs`, or `.cjs`. Use the current working tree, including staged,
unstaged, and non-ignored untracked files. Skip deleted files and non-files.
Normalize repository-relative module paths to `/` separators without a leading
`./`.

These files are not candidates:

- Files ending in `.test.ts` or `.test.tsx` under either root. These match the
  strict unit discovery in `scripts/verification/evidence.mjs`.
- Files ending in `.spec.ts` under either root. The current browser inventory
  runs only those under `tests/browser/`, where `playwright.config.ts` sets
  `testMatch` to `**/*.spec.ts`.
- Declaration files ending in `.d.ts`, `.d.mts`, or `.d.cts` under either root.
- Every file under the exact `tests/fixtures/` tree. Tests load these fixtures
  by path. No other directory named `fixtures` has an implicit exclusion.

The suffixes above are exact and case-sensitive. For example, `.test.js`,
`.test.mts`, and `.spec.tsx` files remain candidates because the current runners
do not discover them. `.jsx` is outside the supported module extensions.

## Import Graph And Export Use

Both export scopes use the same import graph. Declaration files (`.d.ts`,
`.d.mts`, and `.d.cts`) are neither candidates nor importers in either scope.
Exclude them before parsing. Keep every other regular repository module with
a supported extension in the graph, including non-candidates.
Imports and re-exports from `tests/fixtures/`, root configuration files, source
files, unit tests, and browser specs count as uses. The importer does not need
to be reachable from a test runner.

For example, `playwright.config.ts` imports
`tests/browser/example_servers.ts` and `tests/helpers/browser_timing.ts`.
Those imports count even though the configuration file is outside both roots.

Reuse the shared module resolver, package aliases, public export surface, and
[internal-export import-use rules](./verification-ratchets.md#unused-internal-exports).
They cover static ES imports and re-exports, recognized CommonJS use, and
statically resolvable dynamic imports. A named value export is unused when no
distinct repository module imports or re-exports that symbol and the public
surface does not expose it. References inside the exporting file do not make
the export necessary. Default exports and type-only exports are never findings.

## Path-loaded Modules

A path string alone creates no import-use edge. This includes an esbuild entry
point and Playwright's `globalSetup: "./tests/browser/setup.ts"`.
`tests/browser/setup.ts` remains a candidate; its default export is exempt.
Any named value export in a path-loaded candidate that no distinct module
imports is unused. Remove an unnecessary export or keep one exact reviewed
baseline entry when dynamic use requires it. Do not exempt the whole module or
mark all its exports as used because a runner loads its path.

## Baseline And Comparison Commit

The separate baseline is `xtask/unused-test-helper-exports.txt`. Do not put test
helper entries in `xtask/unused-internal-exports.txt`.
Each line is one exact key:

```text
<repository-relative module path>#<export name>
```

The only allowed path prefixes are `tests/` and `packages/viewer/tests/`.
After the prefix, the module path and export name must each be non-empty and
contain no whitespace or `#`. The format check uses:

```text
^(?:tests|packages/viewer/tests)/[^#\s]+#[^#\s]+$
```

Use exact normalized module paths and exported names, including aliases. There
are no globs, comments, blank entries, or wildcard suppressions. Sort complete
keys in ascending UTF-16 code-unit order. Duplicate keys fail. Read the file as
UTF-8, normalize CRLF to LF, and discard one final empty split line when the
file ends in LF. Do not trim entries. An empty file represents an empty set.

Resolve the comparison commit with the
[shared Git comparison rule](./verification-ratchets.md#delivery-status),
normally `git merge-base HEAD origin/main`. Apply all three subset rules:

1. The discovered unused set must be a subset of the current baseline. A new
   unused export outside that baseline fails.
2. The current baseline must be a subset of the discovered unused set. A stale
   entry fails and must be deleted.
3. The current baseline must be a subset of the baseline at the comparison
   commit. An entry absent there fails even when the current scan discovers it.

If the comparison commit predates the baseline file, skip only rule 3 for the
one-time bootstrap. Rules 1 and 2 still apply. After the comparison commit
contains the file, the list can only shrink. A current file is required even
during bootstrap. If it is missing, the audit fails and the error names
`xtask/unused-test-helper-exports.txt`; do not treat it as an empty baseline.
This matches the existing internal-export scope's file-read failure behavior.

## Exact Diagnostics And Summary

Use these finding and format-error texts, with `<key>` or `<entry>` replaced by
the complete baseline line:

```text
new unused test helper export: <key>
stale baseline entry: delete <key>
baseline entry was not present at the comparison commit: <key>
unused test helper export baseline must be sorted
unused test helper export baseline contains duplicates
invalid unused test helper export baseline entry: <entry>
```

Return all findings for the scope, remove duplicate findings, and sort them in
ascending UTF-16 code-unit order before reporting failure. The audit label is
`Unused test helper export`. The runner prints these lines on standard error:

```text
Unused test helper export ratchet failed:
- <finding>
```

An operational error, including a missing current baseline file, uses
`Unused test helper export ratchet could not run: <error>`. Keep the underlying
error details, including the file name for a failed baseline read.

The exact passing summary is
`<n> test helper module(s), <m> baseline exception(s)`. Here `<n>` is the number
of candidate modules, and `<m>` is the number of discovered unused exports,
which equals the baseline entry count on a pass. The runner prints:

```text
Unused test helper export ratchet passed (<n> test helper module(s), <m> baseline exception(s)).
```

## Gate Placement And Evidence

The audit in `scripts/verification/repository-ratchets.mjs` runs after the
`Unused internal export` audit and before the `Public package export` audit.
It runs after the live dependency audit, in both
`cargo xtask check --suite repository` and the complete `cargo xtask check`.
The repository ratchet runner continues through every audit and fails if any
audit reports a finding or cannot run.

Both export audits read and parse repository modules once per ratchet run.
They share the graph result, including an operational error. Such an error
makes both audits report `could not run`. Each audit reads and checks its own
current and comparison baselines after the shared analysis.

Focused tests cover:

- `tests/test_helper_export_ratchet.test.ts`: both roots, exact exclusions,
  declaration-file exclusion, config and source importers, path-only loads,
  cross-scope use, baseline prefixes, format errors, and subset rules.
- `tests/test_helper_export_ratchet_git.test.ts`: new findings, bootstrap,
  baseline growth, missing files, shared errors, one module read per run,
  unchanged source output, summary text, and audit order.
- `tests/repository_ratchets*.test.ts` and the public-export ratchet tests:
  existing source behavior, CommonJS, Git comparison boundaries, and release
  surfaces.
