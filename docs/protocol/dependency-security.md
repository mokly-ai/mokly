# Dependency Security

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Verification Boundary

`npm run dependencies:check` audits the workspace lockfile against the
configured npm registry's current advisory database. It explicitly includes
production, development, optional, and peer dependencies, even if local npm
configuration would otherwise omit a category. The Node entry point is
`scripts/verification/dependency-audit.mjs`. Both audit modes run `npm audit
--json --audit-level=low --package-lock-only --include=prod --include=dev
--include=optional --include=peer --prefix .` against the live registry.
Strict mode fails on every uncovered Low-or-higher advisory or exception issue. Registry,
transport, report, and input errors always fail. The
[baseline audit contract](./dependency-audit-baseline.md) defines the
modes, CLI, JSON summary, and comparison rules.

`npm run dependencies:check` stays strict. Under this contract,
`cargo xtask check` runs the baseline audit first by default. Ordinary pull
requests and every push also use baseline mode in the shared repository
prerequisite. It prints inherited findings and exception issues as notices;
new issues fail. Release Please and dependency update pull requests use strict
mode. The daily scheduled workflow audits `main` strictly and creates or
refreshes the [dependency update pull request](./dependency-audit-update-pr.md).
It closes that pull request when the strict audit of `main` passes and preserves
branches with human commits. Audit command, registry, report, and input failures
do not change pull requests.
Dependency fixes, pinned-parent overrides, and reviewed exceptions land there.

The release workflow runs a strict live audit immediately after install,
before reusable evidence or the complete fallback. Complete mode runs
`cargo xtask check --dependency-audit strict` and repeats the strict live audit
when its gate starts. Evidence mode never reuses an earlier audit
as time-sensitive security evidence. The CI repository prerequisite must pass
before viewer, browser, or native jobs start. A cache hit never replaces
an audit. Both modes require registry access. An audit is evidence about known
advisories at execution time, not a guarantee that every dependency is safe.
See the [CI workflow graph](./ci-workflow.md) and
[CI verification contract](./ci-verification.md) for job ownership and aggregation.

The release workflow's packed ESM-consumer smoke also audits its freshly
resolved production, optional, and peer dependencies before exercising the
installed CLI, on the publish job's Node runtime before publication. This is a
separate boundary: npm does not apply Mokly's workspace overrides or lockfile to
downstream installations. Other consumer smokes exercise their respective
integration contracts without duplicating registry requests. This production
audit has no exceptions. It calls strict `npm audit` directly in the release
smoke and never loads the workspace exception file. Consumers must maintain and audit their own
lockfiles, including dependencies they bring to their renderer or application.

## Rust Advisory Audit

The Rust dependency audit is independent of npm baseline comparisons and
exceptions. `npm run dependencies:check:rust` audits every crate in the committed
`Cargo.lock` against the current RustSec advisory database. It verifies pinned
`cargo-audit` 0.22.2 source before extraction, then builds it with the committed
tool lock and locked resolution, so no update silently changes the tool.
Reported vulnerabilities and audit errors fail verification. Informational
warnings remain visible. The repository `.cargo/audit.toml` configuration exempts
only RUSTSEC-2026-0235. `lightningcss` 1.0.0-alpha.72 with `bundler` requires
`parcel_sourcemap` 2.1.1, which requires `rkyv` 0.7.46. Mokly never reads or
writes source maps. Review this exception by 2027-01-31 or at the next
`lightningcss` update, whichever comes first. Every other vulnerability fails.
The command rejects any other ignored advisory ID, any severity threshold,
or any target architecture or operating system filter. It also fails after
2027-01-31 UTC or when locked `lightningcss` changes, even without the approved
ID. These date and version failures require a reviewed script change.
The repository suite, daily dependency audit, and release verification run it.
A release with reusable CI evidence still runs a fresh Rust audit. The daily
and release Rust audits run with read-only permissions and no publication
credentials. Release publication depends on successful read-only preparation.
The daily npm update automation keeps its npm report and does not update Rust crates.
Rust fixes require a reviewed dependency change. A cached tool or build never
replaces the live advisory check.

## Reviewed Workspace Exceptions

`scripts/verification/dependency-audit-exceptions.json` is a JSON array. It is
empty while no risk is accepted. Each record has exactly these six required
fields, with no unknown keys. This example shows the shape only; it is not a
current exception:

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
  "reason": "Dev-only React Native peer dependency. The repository does not run Metro or send untrusted patterns to it. No patched release is available.",
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

Both modes evaluate every record with the same validity, expiry, and use
rules. Baseline mode can inherit only an identical issue from the comparison
commit; it does not relax exception coverage. An expired record remains an
issue even when its advisory is gone. A stale record with no current finding
also remains an issue; remove it when the risk disappears. Any other advisory, including a
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

Update from an installed tree: run `npm ci`, then `npm update <package>`.
Use the npm version that `packageManager` pins; the
[CI workflow graph](./ci-workflow.md#job-execution) explains why lockfile
changes need it. Lockfile-only mode can record bundled entries of optional platform packages
that this machine does not install. Keep the lockfile diff to the intended
entries.

Use a narrowly scoped override only to select a patched release when a parent
pins an affected dependency and a compatible parent update is not appropriate.
Do not use an override to replace an unpatched package. Document why it exists and
the conditions for removing it. Audit every dependency category after an update;
an old override is not proof that the current tree is clean.

Record each hold below a compatible release with its reason and removal
condition. Write locked versions as `` `package` X.Y.Z ``, or add "or newer"
for a declared floor. Dependency audit tests check the committed exception
file against the installed lockfile.

List only reviewed exceptions, overrides, exact pins and holds here, because
later updates must respect them. Explain a one-time update in its pull request,
and describe a runtime dependency's role in the protocol doc of the feature that
uses it.

The current maintenance choices are:

- `wrangler` 4.151.0 is an exact development pin for preview deployment and
  the Cloudflare local static-host checks. It resolves prerelease Miniflare
  `5.20261012.0-beta` and adds 29 development packages, including workerd and
  sharp/libvips. Miniflare's exact `undici` pin is overridden, as the next
  item says. Update the pin in a reviewed tooling change after static URL,
  header, preview cleanup, and live dependency-audit checks pass. Remove it if
  previews no longer use Cloudflare.

- `undici` 7.30.1 is an override scoped to `miniflare`, which pins `undici`
  7.29.1. That release has GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472, and
  GHSA-xjj6-f33q-929c, and 7.30.1 patches all three. A parent update does not
  help: `wrangler` 4.152.0 resolves a Miniflare with the same pin. Remove the
  override when the pinned `miniflare` resolves `undici` 7.30.1 or newer.

- `release-please` 17.6.0 is an exact development pin. Release tests exercise
  its real manifest parser, changelog writer, workspace plugin, and version
  updaters. Update the pin with the workflow action and schema in a reviewed
  tooling change. It is not a runtime dependency of any published package.

- `react-native-reanimated` 4.3.4 stays on its 4.3 line through a tilde range.
  Releases 4.4 through 4.6 each need a newer `react-native-worklets` line (0.9
  through 0.12), which the root `^0.8.3` range excludes. Move to one of them
  only in a reviewed change that also moves `react-native-worklets` to the
  matching line. Release 4.7 needs React Native 0.86 through 0.88 and
  `react-native-worklets` 0.13, but every `@firna/ui` release, including
  0.15.0 and 4.0.0, accepts only React Native below 0.86. Move to 4.7 only
  after `@firna/ui` accepts React Native 0.86, in a reviewed change that also
  moves `react-native-worklets` to 0.13.
- `react-native-svg` 15.15.5 stays on its 15.15 line through a tilde range.
  Release 15.16.0 imports `TurboModuleRegistry` from `react-native`, which
  `react-native-web` does not export, so Serve and `build` cannot bundle the
  example catalogue through its `react-native` alias. Move to a later release
  only after one works with that alias, in a reviewed change that runs the
  design catalogue test and `npm run package:smoke`.
- `@playwright/test` 1.61.1 stays locked. Playwright 1.62 and later exit with
  status 1 when a reporter event write fails, but the wrapper test in
  `tests/verification_wrapper.test.ts` expects the 1.61 status 0. Update that
  test in a reviewed change before moving Playwright.

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
`implementation-review` skill against `origin/main`; apply its review-fix rule
to the findings.
