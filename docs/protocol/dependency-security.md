# Dependency Security

Status: Follow-up work remains in the [Wrangler dependency claim item](../../plans/follow-ups/dependency-security-wrangler-claim.md).

## Verification Boundary

`npm run dependencies:check` audits the workspace lockfile against the
configured npm registry's current advisory database. It explicitly includes
production, development, optional, and peer dependencies, even if local npm
configuration would otherwise omit a category. Strict mode fails on every
uncovered Low-or-higher advisory or exception issue. Registry, transport,
report, and input errors always fail. The
[baseline audit contract](./dependency-audit-baseline.md) defines the npm audit
command, the modes, the CLI, the JSON summary, the comparison rules, and the
mode that each command and CI event selects.

The daily scheduled workflow audits `main` strictly and maintains the
[dependency update pull request](./dependency-audit-update-pr.md). Dependency
fixes, pinned-parent overrides, and reviewed exceptions land there.

Release preparation runs the strict live audit under the
[release evidence contract](./npm-release-evidence.md#verification-modes) and
never reuses an earlier audit as time-sensitive security evidence. The other
CI jobs start without waiting for the CI repository job's audit, and
`Required CI` fails unless it passes. An audit gate before those jobs was
rejected: they hold only a read-only token, and the gate would delay every
run.
A cache hit never replaces an audit. Both modes require registry access. An
audit is evidence about known advisories at execution time, not a guarantee
that every dependency is safe. See the [CI workflow graph](./ci-workflow.md)
and [CI verification contract](./ci-verification.md) for job ownership and
aggregation.

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

`scripts/verification/dependency-audit-exceptions.json` is a JSON array.
Each record requires `advisory`, `package`, `path`, `until`, `reason`, and
`tracking`. Only private-app records add `kind`, with the exact value
`"private-app"`. Other keys and kinds fail. The explicit kind prevents silent scope changes.
This dev-only example is not a current exception:

```json
{
  "advisory": "GHSA-vfj7-8cjw-p6xm",
  "package": "braces",
  "path": ["node_modules/tool", "node_modules/braces"],
  "until": "2026-11-03",
  "reason": "Dev-only tool reads repository patterns. No patched release is available.",
  "tracking": "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm"
}
```

`advisory` must be a GHSA identifier. `package` must be an npm package name.
`reason` must be non-empty text. `tracking` must be an absolute HTTPS URL.
`until` must be a real calendar date in exact `YYYY-MM-DD` form.
`path` must contain at least two distinct normalized relative locations.
Use forward slashes and npm package names after `node_modules`.
Absolute paths, empty segments, dot segments, backslashes, and a final package
that differs from `package` are invalid. Records with the same advisory,
package, and path are duplicates, even if their dates or review text differ.
The script, declarations, and exception data remain outside the packed package.

An exception covers only the advisory whose GHSA identifier comes from its
GitHub advisory URL and whose vulnerable package matches `package`.
The final path element must be a reported vulnerable install location.
An advisory with several install locations passes only when every location has
one valid record for that advisory and package. An uncovered location fails.
Several records for the same advisory, package, and location fail, even with different paths.

A record without `kind` is dev-only. Every path entry must be a lockfile
install location with `dev: true`. A missing development flag or
`devOptional: true` rejects it. Each entry after the first must have only the
preceding entry as its dependent. All dependency scopes count, including
`devDependencies`, so a new direct development edge rejects coverage.
The first entry is the reviewed boundary. Its dependents may differ.

A private-app path starts at a private workspace directly under `apps/`.
Its actual `package.json` must have `"private": true`. Each later entry must
be an installed package reached by a real lockfile dependency edge.
Development, production, optional, and peer edges can form this path.
It need not have sole dependents or development-only install flags.
Each edge resolves through the nearest `node_modules`, including scoped and
nested packages. Workspace links resolve through their local package entries.
Missing entries, missing edges, and changed resolutions reject the record.

The vulnerable location must be absent from the production dependency closure
of every published workspace. Published means its actual manifest does not
have `"private": true`. This closure includes `dependencies`,
`optionalDependencies`, and `peerDependencies`, including edges through
workspace links. It excludes development edges.
Every audit reads the local package manifests to check privacy and published
reach again. Baseline comparison includes these manifest bytes.
A new published production edge to the vulnerable location rejects coverage.

The UTC end date is inclusive. `2026-11-03` passes through that day's last
millisecond and expires at `2026-11-04T00:00:00Z`. An end date more than 31
calendar days after the current UTC date fails. Renew only with a new risk
review and a new end date in a reviewed change. Never extend a record automatically.

Both modes apply the same validity, expiry, and use rules to every record.
Baseline mode can inherit only an identical issue from the comparison commit.
It does not relax coverage. An expired record remains an issue when its
advisory is gone. A stale record with no current finding also fails.
Remove a record when its risk disappears. Another advisory on the same package
needs its own reviewed record. Invalid paths, JSON, fields, dates, and
duplicate records fail.

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

After a dependency update, run the complete gate from a clean `npm ci` and
exercise the real preview runtime through its browser tests. Review lockfile
removals, package engines, native optional packages, and the packed artifact.

Record each hold below a compatible release with its reason and removal
condition. Write locked versions as `` `package` X.Y.Z ``, or add "or newer"
for a declared floor.

List only reviewed exceptions, overrides, exact pins and holds here, because
later updates must respect them. Explain a one-time update in its pull request,
and describe a runtime dependency's role in the protocol doc of the feature that
uses it.

The current maintenance choices are:

- `wrangler` 4.164.0 is an exact development pin for preview deployment, the
  Cloudflare local static-host checks, the cloud site, and the cloud origin
  router. It resolves prerelease Miniflare `5.20261117.0-beta`, which pins
  `undici` 7.30.1. `@cloudflare/vitest-plugin` 1.8.4 pins the same Wrangler.
  Update the pin in a reviewed tooling change after static URL, header,
  preview cleanup, origin-router tests, and live dependency-audit checks pass.

- `minimatch` 11.0.3 is an override scoped to `eslint`,
  `@typescript-eslint/typescript-estree`, `@google-automations/git-file-utils`,
  and `code-suggester`. Packages under these parents declare `minimatch` 10
  or 3, which have GHSA-g3hv-75wg-m249. Release 11.0.1 is the first patched
  release, and no current release of these packages accepts it. The
  `code-suggester` scope reaches its `glob` 7, which cannot use `minimatch`
  11, but `code-suggester` never loads `glob`. Remove a scope when, without
  it, every `minimatch` under its parent resolves to 11.0.1 or newer.

- `eslint-plugin-import-x` shares hoisted `minimatch` 10.2.6 with private
  cloud tools. A private-app exception covers GHSA-g3hv-75wg-m249 at this
  location. The plugin cannot load `minimatch` 11, which removed its imported
  `makeRe` export. Remove this record only after every affected parent accepts
  a fixed release or the vulnerable install disappears.

- `release-please` 17.6.0 is an exact development pin. The repository's
  release configuration checks use its real manifest parser, changelog
  writer, workspace plugin, and version updaters. Update the pin with the workflow action and schema in a reviewed
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
  status 1 when a reporter event write fails, where 1.61 exits with status 0.
  Move Playwright only in a reviewed change that checks how the browser
  suite's report records a failed reporter.
