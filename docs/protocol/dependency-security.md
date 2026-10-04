# Dependency Security

## Verification Boundary

`npm run dependencies:check` audits the workspace lockfile against the
configured npm registry's current advisory database. It explicitly includes
production, development, optional, and peer dependencies, even if local npm
configuration would otherwise omit a category. The Node entry point is
`scripts/verification/dependency-audit.mjs`. It runs `npm audit --json
--audit-level=low --include=prod --include=dev --include=optional --include=peer`
against the live registry. Every Low, Moderate, High, or Critical advisory fails
unless an active reviewed exception fully covers it. Registry or transport
errors always fail.

`cargo xtask check` runs this audit first and stops on failure. The release
workflow always runs the live audit immediately after installing dependencies,
before it selects reusable CI evidence or the complete fallback. Complete mode
therefore repeats the audit when the full gate starts; evidence mode never
relies on an earlier CI audit for time-sensitive security evidence. Parallel CI
assigns the same live audit to the shared repository prerequisite, which must
succeed before any package, unit, browser or native job starts. A cache hit
never replaces an audit. Verification requires registry access and is
deliberately sensitive to newly published advisories, even when source and
lockfile have not changed. An audit is evidence about known advisories at
execution time, not a guarantee that every dependency is safe. See the
[CI workflow graph](./ci-workflow.md) for job ownership and the
[CI verification contract](./ci-verification.md) for its fail-closed aggregate.

The packed ESM-consumer smoke also audits its freshly resolved production,
optional, and peer dependencies before exercising the installed CLI on every
runtime selected for that CI event. Ordinary changes use the minimum supported
Node 22.14 runtime; Release Please pull requests repeat this boundary on Node 24
before publication. This is a separate boundary: npm does not apply Mokly's
workspace overrides or lockfile to downstream installations. Other consumer
fixtures continue to exercise their respective integration contracts without
duplicating registry requests. This production audit has no exceptions. It calls
strict `npm audit` directly in `scripts/package/consumer_cases/esm.mjs` and never
loads the workspace exception file. Consumers must maintain and audit their own
lockfiles, including dependencies they bring to their renderer or application.

## Reviewed Workspace Exceptions

`scripts/verification/dependency-audit-exceptions.json` is a JSON array. Each
record has exactly these six required fields, with no unknown keys:

```json
{
  "advisory": "GHSA-vfj7-8cjw-p6xm",
  "package": "braces",
  "path": [
    "node_modules/metro-file-map",
    "node_modules/micromatch",
    "node_modules/braces"
  ],
  "until": "2026-11-03",
  "reason": "Dev-only Metro is not run by this repository; it receives no untrusted patterns.",
  "tracking": "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm"
}
```

`advisory` must be a GHSA identifier. `package` must be an npm package name.
`reason` must be non-empty text. `tracking` must be an absolute HTTPS URL.
`until` must be a real calendar date in exact `YYYY-MM-DD` form.
`path` must contain at least two distinct normalized relative lockfile install
locations. Use forward slashes and npm package names after `node_modules`.
Absolute paths, empty segments, dot segments, backslashes, and a final package
that differs from `package` are invalid. Records with the same advisory,
package, and path are duplicates, even if their dates or review text differ.
The script, declarations, and exception data remain outside the packed package.

An exception covers only the advisory whose GHSA identifier comes from its
GitHub advisory URL and whose vulnerable package matches `package`. Its reported
`vulnerabilities[package].nodes` must contain exactly one install location: the
last path element. All path entries must exist in the lockfile and have
`dev: true`; `devOptional: true` or a missing development flag means production
and rejects the exception.

For every path element after the first, the preceding element must be its only
dependent. The evaluator reads `dependencies`, `optionalDependencies`, and
`peerDependencies` from every lockfile package, including the root (`""`) and
workspace entries such as `packages/viewer`. It also checks `devDependencies`,
so a new direct development dependency cannot bypass the sole-dependent rule.
Lockfile entry locations must be normalized and relative. It resolves names through
Node's nearest-`node_modules` search, with scoped and nested packages included.
A new dependent of an inner path package or a second vulnerable install
location rejects coverage. The first element is the reviewed path boundary;
its own dependents can differ, but it must remain dev-only.

The UTC end date is inclusive. `2026-11-03` passes through that day's last
millisecond and expires at `2026-11-04T00:00:00Z`. An end date more than 31
calendar days after the current UTC date fails. Thus `2026-10-03` through
`2026-11-03` is the maximum window. Renew only with a new risk review and a new
end date in a reviewed change. Never extend a record automatically.

Every record must be valid, active, and used. An expired record fails even when
its advisory is gone. A stale record that matches no current finding also
fails; remove it when the risk disappears. Any other advisory, including a
second advisory on the same package, fails. A changed path or production path
fails. Malformed JSON, fields, dates, paths, and duplicate records fail.

The report must have `auditReportVersion: 2` and a `vulnerabilities` object with
valid package names, severities, install locations, and non-empty `via` arrays.
Advisory objects must identify the reported package, title, severity, and URL.
Every `via` package name and every supplied `effects` name must refer to another
entry in the report. Effects alone cannot stand in for a missing advisory.
Package-name-only effects are covered when all advisory objects are covered and
all references exist. Cycles such as Metro and Metro Config need no exemption
of their own. Informational findings stay below the Low failure threshold.

An npm JSON `error` object, non-JSON output, invalid report shape, dangling
reference, command launch failure, signal, or unexpected exit code fails.
Only exits 0 and 1 are expected, and the exit must agree with the report before
exceptions apply. Read and parse failures for either input file also fail.

An accepted risk always prints its advisory, package, exact path, end date,
UTC days left, reason, and tracking link. Failures print each uncovered advisory
with its identifier, package, severity, title, URL, and install locations. They
also print each invalid, expired, or stale record and the required action.
Unit tests inject commands, file reads, clocks, and logging; they do not call
the registry. Fixtures retain fields from a real report captured after `npm ci`.

## Update Policy

Investigate each advisory's dependency path and patched versions before changing
package metadata. Prefer compatible targeted updates, preserve the supported
Node floor, and regenerate the lockfile with npm. Do not blindly run
`npm audit fix --force`: an audit's suggested parent change can be a downgrade
or an incompatible toolchain replacement.

Use a narrowly scoped override only to select a patched release when a parent
pins an affected dependency and a compatible parent update is not appropriate.
Do not use an override to replace an unpatched package. Document why it exists and
the conditions for removing it. Audit every dependency category after an update;
an old override is not proof that the current tree is clean.

The current maintenance choices are:

- [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
  / CVE-2026-93687 affects `braces <=3.0.3`, with no patched release at review
  on 2026-10-03. The sole exception ends on 2026-11-03 UTC. Its exact dev-only
  path is Metro File Map 0.84.6 → Micromatch 4.0.8 → Braces 3.0.3 at the three
  top-level install locations above. Metro arrives through React Native peers
  of development packages. Repository code does not run Metro and sends no
  untrusted patterns to it. The tracking advisory records patched releases.
  Remove the record when Braces or Micromatch ships a fix that Metro resolves,
  or when Metro drops Micromatch. Re-run the live audit and complete gate after
  that dependency update. Remove a stale record; expiry requires removal or
  a new explicit risk review, not an automatic extension.
- The runtime glob dependency is `minimatch` 10.2.6 or newer; the workspace
  locks `brace-expansion` 5.0.12. A bounded behavioral regression checks total
  padded output and preserves normal brace alternatives. The
  [upstream advisory](https://github.com/advisories/GHSA-rgw5-rvv9-x895)
  explains why the intermediate-allocation fix requires 5.0.9, not 5.0.8.
- React Native's compatible Metro 0.84 line is updated to 0.84.6, including its
  coupled packages. The
  [0.84.5 security fix](https://github.com/react/metro/releases/tag/v0.84.5)
  removes `image-size` in favor of maintained parsers. Do not override the image
  parser to another affected release or jump Metro compatibility lines just to
  change the audit report.
- Wrangler remains at 4.113.0 with its existing Miniflare/Workerd versions. The
  `miniflare`-scoped overrides select `sharp` 0.35.4 (including patched native
  image libraries) and `undici` 7.29.1. Remove each override when a deliberately
  upgraded Wrangler/Miniflare version resolves a patched version without it and
  passes the complete gate. These overrides do not apply to unrelated dependency
  parents.
- Compatible Browserslist, browser-baseline data, and Nano ID patches remain
  lockfile-only updates; they do not add direct runtime dependencies.
- The PostCSS CSS Modules plugins and `icss-utils` are runtime dependencies
  for rename-only local selectors and exports. Their transitive
  `postcss-selector-parser`, `cssesc`, `util-deprecate` and
  `postcss-value-parser` dependencies are MIT or ISC; they do not evaluate
  consumer code or choose browser targets. Consumer PostCSS packages still
  run only in the isolated worker.
  Mokly now declares `postcss-selector-parser` and `postcss-value-parser`
  directly for its lazy rename-only verification. The lockfile deduplicates
  each with the plugins' existing runtime copies.
- Lightning CSS is a production dependency only for read-only stylesheet rule
  analysis for Changes. Its
  MPL-2.0 native packages and Apache-2.0 `detect-libc` dependency participate in
  the workspace and packed-consumer audits. Retain every platform's optional
  lockfile entry when updating it; ordinary Ubuntu and native macOS/Windows jobs
  exercise the minimum Node 22.14 runtime, and the release-gated Ubuntu matrix
  adds Node 24. Native binaries must remain installed; the Node package does not
  automatically fall back to WASM. See the
  [release platform contract](./npm-release.md#continuous-integration).

## Required Evidence

Add a regression first when a reported bug can be reproduced safely. Keep
malicious-input tests bounded; never run an advisory's unbounded memory or CPU
exhaustion example inside the normal test process. Verification of command
ordering and fail-closed behavior uses the injected command-runner boundary, not
live network calls from Rust unit tests.

After dependency updates, use a clean `npm ci`, run the complete
`cargo xtask check`, and exercise the real preview runtime through its browser
tests. Review lockfile removals, package engines, native optional packages, and
the packed artifact. Commit and push all completed changes before using the
[implementation review prompt](../implementation-review-prompt.md) against
`origin/main`; report new findings for a maintainer's decision.
