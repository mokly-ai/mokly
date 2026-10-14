# Public API Reports And Unused Members

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Public API Reports

Use the maintained `@microsoft/api-extractor` package installed with
`npm install --save-dev @microsoft/api-extractor`, without selecting an older
version. Generate reports from the package declaration outputs after the build.
Commit one report per typed public export-map entry under `etc/api/`: the
`@mokly/mokly` root, which is the authoring API, and the viewer's root,
`runtime`, `browser`, and `data` entries. The side-effect-only browser entry
still needs a report. A committed export-map inventory also records the
viewer's `styles.css` resource entry, which has no TypeScript signature, and
the root package's `mokly` bin, which is the shim. Public subpaths must not
disappear from reporting when the export map changes. A platform package
exports no JavaScript and has no report.

Run API Extractor separately for each entry so its exported signature is not
hidden by an aggregate barrel. Reports include function parameters and returns,
interface and type members, enum values, and reachable public contract types,
including the generated types of the model crate that an entry re-exports.
Preserve optionality, unions, and overloads. Keep reports deterministic and
free of absolute checkout paths. The
[tool's API-report contract](https://api-extractor.com/pages/setup/configure_api_report/)
defines the generated signature format. Reports are deliberate tracked review
artifacts.

Provide separate update and check commands. Update writes the committed
reports; check writes temporary output under `.context/`, compares exact bytes,
and fails when reports are missing, extra, or stale. Neither CI nor the check
command repairs the tracked reports automatically.

Compare report paths and the export-map inventory against `origin/main`,
including additions, removals, and renames. If any report changes, the same
diff must change `docs/protocol/npm-release-notes.md`; otherwise fail with
`Public API reports changed; update docs/protocol/npm-release-notes.md.` This
boundary intentionally uses `origin/main`, not a release tag or the merge base
used by other ratchets. A missing ref is a check failure. The released
export-name check of the [ratchets](./verification-ratchets.md#public-package-exports)
is an independent rule.

Run report verification in CI and the complete gate after declarations are
built. Tests prove that a changed interface member, option, return type, or
subpath is visible; stale reports fail; a report change without a release-note
diff fails; and a matching release-note diff passes. Prove every public entry
is covered, including the browser entry and the CSS resource inventory. The
release note must explain the actual API change, not merely touch the file to
satisfy the check.

## Unused Internal Members

Use a small script under `scripts/verification/` built on the installed
TypeScript language service and `findReferences`. It checks class methods,
getters, setters, and properties in the root package's source directory and in
`packages/viewer/src/`, including members on otherwise-used classes. Report
members with no reference outside their own declaration. An unused-export scan
is not sufficient. Include real test, sidecar, interface, and package-entry uses
when resolving references. Verify a called and an uncalled member in the same
class.

Measure the script on the complete repository. If it takes more than about 60
seconds, restrict candidate declarations to non-exported classes and record the
measured choice beside the command in this page. Keep reference resolution
across all relevant workspace files. Interface fields written but not read are
outside this check; the specifically approved fields are removed manually. Keep
dynamic-use exceptions explicit and reviewed.

Normalize findings to sorted identities containing repository-relative file,
owning symbol, and member. Do not key findings by a moving line number or
accept wildcards. Commit the discovered set as the initial baseline. A new
unused member fails. A stale baseline record also fails and must be removed.
After the baseline reaches the comparison commit, it is shrink-only relative to
the same Git boundary as the internal-export ratchet. Tool failures, malformed
output, and absent configuration fail the check, never an empty set.

Delete only the specifically approved dead code. Other existing findings become
baseline entries rather than an unrelated cleanup. Tests cover live versus
unused members, inherited and interface use, public contracts, stable
normalization, new findings, stale exceptions, and attempted baseline growth.
Run the tool in the repository suite and the complete gate and document its
exact command and checked version.

## ESLint Paths And Fixture Scope

Every exact file path in the real flat ESLint configuration must exist. Test
the actual imported configuration; distinguish glob patterns from literal paths
and respect configuration bases. Removing a module requires removing its
obsolete exact rule entry and synthetic probe. Keep all folder coverage and
simultaneous directory-name and source-order assertions for current paths. Do
not weaken either lint rule.

Browser global setup performs only the Serve readiness work of the
[suite evidence contract](./ci-suite-evidence.md#fixture-lifetime-and-cleanup).
No fixture prepares a baseline, a compiled example, or a packed archive; each
browser worker's server renders the example catalogue from its sources. Record
actual fixture and suite timings without claiming an unmeasured speed
improvement.
