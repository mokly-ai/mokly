# Static Build

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

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
[upload exchange](./mokly-upload.md). Nothing reads the output back; the
[render cache](../architecture/rust-core.md#render-graph) is the only source
of rendered bytes, and no command writes into the repository except `build`
into its output directory.

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
  error and change neither the output nor the exit status. `publish` fails on
  warnings like `build --strict`.
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

| Path                                               | Content                                                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `index.html`, `view/<path>/index.html`, `404.html` | the shell stub, one file per shell route for every current and removed entry, identical bytes      |
| `mokly-viewer/index.json`                          | the catalogue index v7 with `revision: 0`, the stamped `deploymentId`, and no `live` field         |
| `mokly-viewer/entries/<entry path>.json`           | one entry detail v1 per current entry                                                              |
| `static/mokly-generated/<route>`                   | every rendered view and document, with the instance and slot markers of the comparison contract    |
| `static/<closure path>`                            | the authored resources the documents reference                                                     |
| `mokly-viewer/diffs/generations/<generation>/**`   | one comparison generation: review v8, removed entries' details, snapshots, resources, and previews |
| `mokly-viewer/client/**`, `shell.css`, `fonts/**`  | the standalone shell bundle, the inspector, styles, and fonts under `mokly-viewer/`                |
| `.mokly-export-artifact`                           | the [ownership marker v3](./mokly-export-ownership.md), written last                               |

The [shell delivery contract](./mokly-shell-delivery.md) owns the stub, the
index, and the detail shapes. The [static delivery contract](./mokly-export-delivery.md)
owns the routes a host serves, their headers, and caching. The
[public files contract](./mokly-export-public-files.md) owns file selection.
The [browser contract](./mokly-export-browser.md) owns the client inventory
and the deployment identity. The marker lists every file with its digest.

## Changes In The Output

`build` includes Changes unless `--no-changes` is given. It resolves the base
ref and `HEAD`, pins their merge base once, renders the base side from that
commit's Git tree under the [comparison contract](./mokly-comparison.md#sides),
and writes one complete comparison generation. Entry-level Changes attribution
and every screen comparison use that one commit, the same current documents,
and the same source-capture and resource-comparison exclusions. The index carries `base`,
`changesStatus: "ready"`, and the `comparisonUrl` of the generation's
`review.json`; removed screens, pages, documents, components, and variants
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

1. Parse the options, load the configuration, validate the output boundary
   and the existing ownership marker, and reserve the resolved output against
   concurrent writers under the [safety contract](./mokly-export-safety.md).
2. Resolve the base commit without changing the checkout.
3. Record the input fingerprint: the hashes of every inventoried source, the
   configuration, the renderer module, the configured stylesheets, and the
   authored closure. Capture root membership and configured inputs before
   catalogue preparation. Validate the catalogue and render every view through
   the render cache. Render the base side and compute the comparison from those
   inputs. With `--strict`, a warning fails here, before any write.
   Root membership includes matching regular files and folder records under
   the discovery rules. Each root uses its own file patterns and resolved
   directory identity. Child symlinks do not add root members or linked-directory
   walks. Exclude output and reservation
   directories by both logical and resolved paths. Unrelated repository files
   do not participate. Explicit inventoried inputs and reached closure files
   participate even beneath excluded directory names. Resolve each selected
   path inside the real repository before hashing its target bytes.
   For inventoried JavaScript bundle modules, use the sidecar's SHA-256 digest
   of the exact bytes it bundled as the baseline. A missing module digest is
   an internal failure; a later source read cannot replace it. Compare captured digests with
   those baselines before document callbacks run. Keep the baseline for the
   final live recheck. Other reached inputs keep their first captured digest.
   For inventoried PostCSS inputs, retain SHA-256 witnesses from the exact raw
   buffers delivered by observed whole-file reads and module loading. Compare
   every witnessed version before document callbacks and at final checks.
   A conflicting version uses the existing `export-invalid` input-change outcome
   and preserves owned output. Cache hits and worker replacement retain the
   original witnesses. A later scan cannot replace them.
   PostCSS evidence always carries incomplete coverage. Native addons, helper
   processes, uninstrumented workers, descriptor and partial reads, and private
   loader metadata can escape observation. Known unobserved inputs retain their
   late baseline and the live recheck. That baseline does not detect an edit
   between an opaque read and capture. One observed read never makes a path or
   context complete. The [PostCSS evidence contract](./mokly-sidecar-postcss.md#read-evidence)
   defines this stage's coverage. Staged observation preserves compatible plugins;
   enforced immutable inputs are not required. The full consumed-byte guarantee
   remains open.
   An unreadable input or directory has a fixed unreadable marker. Catalogue
   discovery and validation report required-input failures first. An unreadable
   excluded input does not fail the fingerprint check unless its marker changes.
   Opaque CSS assets keep their first captured digest without retaining their
   payload during preparation. Delivery copies through bounded chunks and
   checks that digest before admitting final immutable output bytes. A mismatch
   is an input change; it cannot replace the baseline with a later digest.
   Before installation, compare selected root membership, unreadable markers,
   resolved identities, and live streaming digests with the captured values.
   This recheck reads no file bodies for parsing or delivery. A change from a
   captured baseline or a mismatched sidecar digest aborts with `export-invalid` and the instruction
   to build again. It preserves the earlier output instead of mixing generations.
4. Assemble every route and resource into a private stage inside the
   reservation on the output filesystem. Validate each path against the
   marker's [portable-path rule](./mokly-export-ownership.md#file-contract)
   when it enters the one collision-checked inventory. A regular file over
   64 MiB fails `export-invalid` before staging.
5. Finalize the [deployment identity](./mokly-export-browser.md#deployment-identity)
   from every staged file except the marker and the publication metadata that
   `publish` declares, stamp it into the index and the current details, hash
   the exact final bytes of every file, and add the marker last. Verify
   internal references, ownership, every route and directory-prefix collision
   including the marker path, and the complete local dependency closure.
   Recheck the inputs under step 3 before installation.
6. Drain render work and stop the sidecars. Replace the owned output with
   rollback protection, then clean the owned temporary resources and release
   the reservation.

Failure, SIGINT, or SIGTERM before installation restores the captured earlier
output when recovery is safe. A destination recreated during the operation is
preserved beside the retained backup instead of being overwritten. A
post-installation cleanup failure keeps the installed site and names the
remaining recovery paths. The [recovery contract](./mokly-export-recovery.md)
defines captured-backup validation, bounded deletion, restoration conflicts,
and the precedence of primary and cleanup errors. There is no cross-process
atomicity guarantee for arbitrary edits to the repository or to the private
reservation namespace.

Cancellation is checked again after ownership validation and after the old
directory moves to backup. The stage-to-output rename is the commit point;
once started it is drained together with cleanup, never interrupted.

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
clean checkout, fails on warnings before it writes or uploads, and
`publish --no-changes` builds current-only. A failed upload keeps the built
directory in place.

## Output Safety

Output confinement and ownership reservations follow the separate
[safety contract](./mokly-export-safety.md). The output inventory and the
imported CSS capture continue in
[Static Build Public Files And Package Boundary](./mokly-export-public-files.md);
the [ownership marker](./mokly-export-ownership.md) records exact file bytes.
