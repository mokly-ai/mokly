# Static Build

## Scope

`mokly build` validates the catalogue, renders every view in memory, and
writes one complete static catalogue into an output directory. The output
holds the Browse shell, every screen, component, use case, page, and Markdown
document, and the comparison the catalogue is configured for. A static host
serves it without a Mokly process, the consumer's source tree, Node.js, or Git.

Mokly owns the output. Consumers own deployment, credentials, domains, access
control, and host configuration. `build` uploads nothing, fetches nothing from
Git, and performs no commit, push, npm publication, or hosting-account
operation. `publish` is the one command that uploads: it runs this same build
into its own private directory outside the repository, then runs the
[upload exchange](./mokly-upload.md). Nothing reads the output back. No
command writes into the repository except `build` into its output directory.

## Command

```bash
npx mokly build
npx mokly build --out .context/site --strict
npx mokly build --config docs/mokly.config.json --base main
npx mokly build --no-changes
```

- `--out <directory>` names the output directory. Without it the output is
  `mokly-static/` at the repository root, which Git must ignore. A relative
  path resolves against the loaded configuration's directory, like every
  configured path. The directory must satisfy the
  [output safety contract](./mokly-export-safety.md); `--out` on `serve` fails.
- `--strict` fails the build on warnings as well as on errors. Without it,
  [build warnings](./mokly-build-warnings.md) print once each on standard
  error and change neither the output nor the exit status. `publish` follows
  the same opt-in strict policy.
- `--config <path>` uses the
  [configuration discovery](./mokly-configuration.md#configuration-discovery) rules.
- `--base <ref>` overrides `review.base`; omission uses that setting, whose
  default is `origin/main`. `--no-changes` writes a current-only build under
  the [publication contract](./mokly-publication.md) and rejects `--base`.
- `--help` lists these rules without loading the configuration or touching
  the output.
- A missing value, an empty output path, an unknown or repeated option, and
  `--port`, `--open`, or `--watch` on `build` fail as `cli-invalid` before any
  write. Watch belongs to `serve`.
- Success exits zero after installation and prints the output directory and
  the instruction to deploy its contents as the site's document root.
- Failure exits non-zero with an actionable category: `build-invalid` for a
  catalogue error, `export-invalid` for a destination, inventory, or
  transaction failure, `cli-invalid` for the command line. Author errors print
  no stack; the [terminal error contract](./mokly-terminal-errors.md) owns the
  output.

`build` starts no server and no watcher. It starts the
[render sidecar](./mokly-sidecar.md) only when the catalogue needs JavaScript.
The build runs the same discovery, validation, rendering, and link checks as
Serve, so there is no separate validation command: a validation-only run is a
build into a temporary directory.

## Output

Paths are relative to the output directory. Every rendered file name derives
from its entry's path under the [artifact path contract](./mokly-artifact-paths.md).

| Path                                               | Content                                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `index.html`, `view/<path>/index.html`, `404.html` | the shell stub, one file per shell route for every current and removed entry, identical bytes   |
| `mokly-viewer/index.json`                          | the catalogue index with `revision: 0`, the stamped `deploymentId`, and no `live` field         |
| `mokly-viewer/deployment.json`                     | the static deployment file with `schemaVersion: 1` and the index's `deploymentId`               |
| `mokly-viewer/entries/<entry path>.json`           | one entry detail per current entry, with a content `detailId`                                   |
| `static/mokly-generated/<route>`                   | every rendered view and document, with the instance and slot markers of the comparison contract |
| `static/<closure path>`                            | the authored resources the documents reference                                                  |
| `mokly-viewer/diffs/generations/<generation>/**`   | one comparison generation: removed entries' details, snapshots, resources, and previews         |
| `mokly-viewer/client/**`, `shell.css`, `fonts/**`  | the standalone shell bundle, the inspector, styles, and fonts under `mokly-viewer/`             |
| `.mokly-export-artifact`                           | the [ownership marker](./mokly-export-ownership.md), written last                               |

The [format inventory](./mokly-format-versions.md) gives the version of each
JSON file. The [shell delivery contract](./mokly-shell-delivery.md) owns the
stub, the index, and the detail shapes. The [static delivery contract](./mokly-export-delivery.md)
owns the routes a host serves, their headers, and caching. The
[public files contract](./mokly-export-public-files.md) owns file selection.
The [browser contract](./mokly-export-browser.md) owns the client inventory
and the deployment identity. The deployment file is excluded from that
identity. The marker lists every file with its digest, including the
deployment file.

## Changes In The Output

`build` includes Changes unless `--no-changes` is given. It resolves the base
ref and `HEAD`, pins their merge base once, renders the base side from that
commit's Git tree under the [comparison contract](./mokly-comparison.md#sides),
and writes one complete comparison generation. Entry-level Changes attribution
and every screen comparison use that one commit, the same current documents,
and the same source-capture and resource-comparison exclusions. The index carries `base`,
`baseCommit`, `changesStatus: "ready"`, and the `comparisonUrl` of the
generation's root; removed screens, pages, documents, components, and variants
keep their base context under [removed previews](./mokly-removed-previews.md),
and a current and a removed record never share a path.

A build with Changes requires a Git checkout with `HEAD`, the base ref, and
their merge base. CI fetches enough history before it runs the command;
`build` never fetches. A missing repository, an unresolvable ref, or a missing
merge base, including shallow history, fails the build and names the ref. A
base whose sources fail the current validation makes Changes unavailable with
those diagnostics: the build completes with `changesStatus: "unavailable"`,
`comparisonUrl: null`, and no generation. A current-only build has
`changesStatus: "disabled"`, `comparisonUrl: null`, no `base`, and no
removed entries.

Ignored-only edits, source moves, and unreferenced files alone add no entry
and no evidence. The navigation filter is never derived by counting changed
comparison screens. The output directory, its reservation and backup paths,
and their resolved aliases are excluded from source capture and
resource comparison, so building twice never makes a build affect its own
Changes; Serve's watcher ignores the same paths.

## Output Transaction

`build` validates the output boundary and the existing ownership marker, and
reserves the resolved output against concurrent writers under the
[safety contract](./mokly-export-safety.md), before it resolves Git or
renders. It resolves the base commit without changing the checkout. With
`--strict`, a warning fails the build before any write.

### Input Fingerprint

`build` fingerprints its inputs: every inventoried source, the configuration,
the renderer module, the configured stylesheets, the authored closure, and
the membership of every root. Root membership is captured when the build
starts, before catalogue preparation. An edit to a fingerprinted input during
the build aborts with `export-invalid` and the instruction to build again.
The earlier output stays in place instead of mixing generations.

Root membership includes matching regular files and folder records under the
discovery rules. Each root uses its own file patterns and resolved directory
identity. Child symlinks do not add root members or linked-directory walks.
The output and reservation directories are excluded by both logical and
resolved paths. Unrelated repository files do not participate. Explicit
inventoried inputs and reached closure files participate even beneath
excluded directory names. A selected path resolves inside the real
repository, and the fingerprint hashes the bytes of its target.

Installed stylesheets that Mokly resolves itself, their `url()` assets, the
`package.json` files that this resolution reads, PostCSS plugin modules, and
the package manifests that PostCSS module resolution names participate. The
fingerprint excludes JavaScript modules that the sidecar bundles from
`node_modules`, files under `node_modules` that a PostCSS plugin reports,
`.gitignore` and the Git index, ancestor `tsconfig.json` files, ancestor
`package.json` files that PostCSS module resolution does not name, missing
resolution candidates, the file list of a directory that a PostCSS plugin
reports, files that a PostCSS plugin reads without reporting them, and files
that a render callback reads without an import. An edit to one of these
during a build is not detected. These include an installed stylesheet that a
PostCSS plugin inlines. Decision: the fingerprint covers only the build's
inputs. A walk of every repository file was rejected because it hashes
unrelated files on every build and stops a build when an unrelated file
changes.

The baseline of a bundled JavaScript module is the digest of the exact bytes
that the sidecar bundled. The baseline of every other input is its first
captured digest. A later read never replaces a baseline. A PostCSS input also
counts as changed when it conflicts with a read witness of the
[PostCSS evidence contract](./mokly-sidecar-postcss.md#read-evidence),
including a changed target with equal bytes. Bundled modules and PostCSS
witnesses are compared before document callbacks run. PostCSS coverage stays
incomplete under its [coverage rules](./mokly-sidecar-postcss.md#incomplete-coverage),
so an edit between an unobserved read and its capture is not detected. An
opaque CSS asset follows the
[asset delivery rules](./mokly-imported-styles-assets.md#validation-and-the-render-cache):
a mismatch with its first captured digest is an input change.

An unreadable input or directory has a fixed unreadable marker. Catalogue
discovery and validation report required-input failures first. An unreadable
excluded input does not fail the fingerprint check unless its marker changes.

Before installation, `build` checks every input again: root membership,
unreadable markers, resolved identities, and digests. Any change from a
captured baseline aborts with the input-change outcome above.

### Assembly And Installation

Every route and resource enters one collision-checked inventory. Each path
must pass the marker's
[portable-path rule](./mokly-export-ownership.md#file-contract) when it
enters. A regular file over 64 MiB fails the build with `export-invalid`. The
[deployment identity](./mokly-export-browser.md#deployment-identity) covers
every file except the marker and the publication metadata that `publish`
declares. The marker hashes the exact final bytes of every file. Before
installation, `build` verifies internal references, ownership, every route
and directory-prefix collision including the marker path, and the complete
local dependency closure. The sidecars stop before installation. Installation
replaces the owned output with rollback protection.

Failure, SIGINT, or SIGTERM before installation restores the captured earlier
output when recovery is safe. A destination recreated during the operation is
preserved beside the retained backup instead of being overwritten. A
post-installation cleanup failure keeps the installed site and names the
remaining recovery paths. The [recovery contract](./mokly-export-recovery.md)
defines captured-backup validation, the commit point, bounded deletion,
restoration conflicts, and the precedence of primary and cleanup errors.
There is no cross-process atomicity guarantee for arbitrary edits to the
repository or to the private reservation namespace.

A non-portable candidate fails with this exact message, where `<path>` is the
path written as a JSON string so that invisible characters are visible and no
file content is exposed:

```text
[mokly/export-invalid] The output path "<path>" is not portable. Rename that file or folder, then build again.
```

JSON permits DEL and the C1 controls as literal characters, so any category
Cc character still present in that string is written as lowercase `\uXXXX`
before it reaches the terminal.

## Publish

`publish` runs this transaction into an output directory inside its own
private directory outside the repository. No option names that output. The
`Mokly publish build` line of the [terminal errors contract](./mokly-terminal-errors.md) reports the output path. The command then
uploads the result under the [upload contract](./mokly-upload.md). It needs a
clean checkout, fails on warnings only with `--strict` before it writes or uploads, and
`publish --no-changes` builds current-only. Private-directory retention and
cleanup follow the [upload cleanup rule](./mokly-upload.md#cli).

## Output Safety

Output confinement and ownership reservations follow the separate
[safety contract](./mokly-export-safety.md). The output inventory and the
imported CSS capture continue in
[Static Build Public Files And Package Boundary](./mokly-export-public-files.md);
the [ownership marker](./mokly-export-ownership.md) records exact file bytes.
