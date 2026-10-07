# Generated Output, Git State, And Asset Closure

## Delivery Status

The command, closure, unified layout and writer behavior follows
[Generated Output Simplification](../../plans/generated-output-simplification.md).
[Unified output](./mokly-unified-output.md), [manifest v9](./mokly-generated-manifest.md),
[configuration](./mokly-configuration.md), [baseline selection](./mokly-derived-baselines.md),
[baseline storage](./mokly-baseline-storage.md) and [terminal output](./mokly-terminal-output.md)
and [viewer namespace](./mokly-viewer-namespace.md) define the implemented contract.
The approved [public closure](./mokly-public-closure.md),
[watch writers](./mokly-watch-writers.md), [comparison inventories](./mokly-comparison-inventory.md)
and [boundary results](./mokly-boundary-results.md) define the pending review fixes.
The [lint contract](./mokly-directory-lint.md) defines implemented folder coverage
and duplicate-import checks.

## Roots And Paths

`mockupsDir` is the catalogue directory. Its fixed, Mokly-owned child
`<mockupsDir>/mokly-generated/` holds generated documents/fragments and the
manifest, plus compiled CSS and copied assets.
No authored file belongs in this child. HTML routes derive from file-derived
entry paths and view axes; for example, `account/home/index.mobile.html` is
stored at `<mockupsDir>/mokly-generated/account/home/index.mobile.html`.
The fixed outer prefix is separate from entry identity. The shared
[path rules](./mokly-paths.md) and reserved output segments still apply.
Authored assets stay at their original
paths below `mockupsDir`, including stylesheet-rule paths, which remain relative
to `mockupsDir`. Output, cache, and authored input paths must remain confined
under the configured repository root through both lexical and real paths.

Deployable generated content uses the plain, tool-owned directory name
`mokly-generated/`: some static hosts and deployment tools skip or deny
dot-directories. Fixed deployed path segments chosen by Mokly must not start
with `.`, `_`, `#`, or `~`. This adds no rejection for user-chosen names:
authored closure paths, mirrored repository paths and entry paths retain their existing
rules. Hosts such as GitHub Pages with Jekyll can still omit user-chosen names
starting with `_`; consumers must configure the host or choose suitable names.
A host may drop the optional root
`.mokly-export-artifact` marker; the viewer never needs it. Upload and local
export recovery still require it. Apart from that optional marker, leading
dots in fixed Mokly names are reserved for local state such as `.mokly-cache/` and transaction
directories. `mokly-viewer/` and `generations/` follow the same
[namespace contract](./mokly-viewer-namespace.md).
Production code defines `GENERATED_DIRECTORY` and `VIEWER_DIRECTORY` once in
`packages/viewer/src/catalogue/delivery_paths.ts`, exports both through
`@mokly/viewer/data`, and the CLI imports those constants directly. ESLint's
`mokly/no-directory-literals` rule rejects other production string, template
and regular-expression literals under `src/`, `packages/viewer/src/`, and
`scripts/preview/`, including escaped spellings. The
[lint contract](./mokly-directory-lint.md) keeps this rule independent of
source-ordering check and covers both directory names.
Only the fixed generated-directory prefix is accepted; no alternate layout alias exists.

Resolved entries, the renderer, module-resolution
package roots, and imported authoring sources may be under `mockupsDir`, but
not under `mokly-generated/` (including through aliases). Explicit configured
inputs under `mokly-generated/` fail `config-invalid` naming the setting and path;
discovered/imported ones fail `config-invalid` naming the source. A route or
closure reference that hits a protected source, symlink, directory, missing
file, or path outside the catalogue fails `build-invalid` with its referring
route. Never use `.gitignore` as evidence of tracked state.

## Tracked State And Commands

Only `check`, after a successful, complete compilation, enumerates index paths with
`git ls-files --cached --full-name -z` under the literal repository-relative
`mokly-generated/` prefix (checking lexical and resolved aliases); exclude neither
ignored nor staged-for-removal paths by consulting `.gitignore`. Let `E` be
all compiled paths under `mokly-generated/`, including the manifest, and `I` all
indexed paths under that prefix. If `I` is empty, output is **untracked**;
if `E` is a subset of `I`, it is **tracked** (extra indexed files are checked
as extra output); otherwise it is **mixed**. If no expected path is indexed
but `E` has paths, an indexed stray path makes the state mixed. Only `check`
runs the independent
`.mokly-cache/` index guard; indexed cache files are invalid. Without Git,
`check` treats output as untracked. A repository whose configured `repoRoot`
differs from Git's top-level root remains `config-invalid` at any Git boundary;
other Git failures remain errors, not an untracked fallback.

The mixed error is `build-invalid` and has this exact text, with paths sorted
lexicographically within groups, repository-relative POSIX names, and no
empty group:

```text
generated output is partly tracked by Git:
tracked:
  - <indexed path>
untracked:
  - <expected path not in index>
Run mokly build and commit every file under <mockupsDir>/mokly-generated/, or run git rm -r --cached -- <mockupsDir>/mokly-generated/ and add /<mockupsDir>/mokly-generated/ to .gitignore.
```

`tracked` lists every indexed `mokly-generated/` path (including extras); omit
`tracked:` if empty. `untracked` lists `E - I`; it cannot be empty in mixed
state. Render the whole generated root repository-relative without `./`:
`mockupsDir: "."` gives `mokly-generated/`, not `./mokly-generated/`.
`check` computes the state once, after compilation, and compares disk only in
tracked state. `build`, `build --watch`, `serve`, `serve --build`, export and
publication do **not** compute tracking or run the cache index guard; no
watched generation refreshes it and no Serve child receives it. A comparison
still needs Git and a valid base independently of head tracking. For example,
adding an entry to a repository that commits `mokly-generated/` must allow `build`
to write the new route; `check` then lists that route under `untracked:` until
it is staged (and then committed as part of the tracked-output workflow).
`build` cannot be blocked by its own remedy.

Only `build`, `build --watch`, and `serve --build` write generated output.
`build --watch` compiles/writes once, then uses the shared event classification
and debounce helpers; a reload or config change
that affects compilation produces a new complete compilation. It writes only
after each **successful, fully validated** compilation and reports each
accepted build; a failure reports the error, retains the last successful tree,
and keeps watching. The watcher ignores `mokly-generated/` and transactional
paths, so its writes never recursively trigger work. A failed initial compile
does not write and continues watching when a watcher can be established.
`serve --build` follows the same write-after-success rule in watched Serve:
the parent prepares the candidate and resource watches, writes only after the
candidate is complete, then hands it to the child; a failed candidate keeps
both the last-good HTTP generation and the previous tree. The child never
writes. `serve --build --no-watch` writes once after initial validation, then
serves without subsequent writes. Plain `serve` and one-shot `serve --no-watch`
never write. Do not finalize files during on-demand HTTP classification,
baseline preparation, export, or publication. See
[watched development](./mokly-watch.md) for event cancellation and shutdown.

For tracked `check`, compare **every regular file** under `mokly-generated/` with
the in-memory expected map by path and exact bytes. A missing tree makes all
expected files missing; an unexpected regular path or empty directory is extra.
A symlink or special entry fails the separate unsafe-tree check before comparison. If any mismatch exists, fail `build-invalid` with this exact text:

```text
generated output does not match source:
missing generated files:
  - <path>
stale generated files:
  - <path>
extra generated files:
  - <path>
Run mokly build and commit every file under <mockupsDir>/mokly-generated/, or run git rm -r --cached -- <mockupsDir>/mokly-generated/ and add /<mockupsDir>/mokly-generated/ to .gitignore.
```

Print only nonempty groups in that order with catalogue-relative POSIX paths
sorted within each group (prefixed `mokly-generated/`); never print placeholders.
On success the plain summary is `Mokly output is current (<n> files).` for
tracked and `Mokly output is valid and untracked (<n> files).` for untracked,
where `<n>` includes the manifest. `build` prints `Generated <n> Mokly files.`
after every successful transaction. Rich equivalents and watched reporting
are specified in [terminal output](./mokly-terminal-output.md).

## Manifest V9 And Per-Commit Baselines

The [manifest contract](./mokly-generated-manifest.md) defines identity-only v9
entries, authored closure, exact generated-file inventory and Git blob hashes.
It also owns canonical per-commit selection, complete inventory verification and
rebuild diagnostics. Only v9 content is readable. Earlier manifests at the selected generated location or after rebuilding
produce the
incompatible-earlier outcome. Invalid caches are partial and rebuild.

## Closure, URLs, And Publication

The public asset surface is a **referenced closure**, not a directory scan.
Seed it with every configured local stylesheet-rule path that applies to a
rendered view and every local renderer resource record. Traverse every local
URL reachable from generated HTML (including nested HTML), generated CSS and
referenced authored HTML/CSS: navigation links, stylesheet and script links,
`src`, `srcset` candidates, CSS `@import` and `url()` references, including
references from nested imports. Generated-to-generated links stay generated;
collect each referenced authored regular file exactly once in `assetClosure`.
Query/fragment-only and remote HTTP(S), `data:`, `mailto:`, and `tel:` links
do not add local files; validate anchors and reject unsupported/escaping
schemes according to the existing link contract. Do not collect unrelated
public files merely because they share a directory. Direct closure references
outside `mockupsDir` remain unsupported. The merged
[imported CSS pipeline](./mokly-unified-output.md) may instead deliver outside
sources as compiled/copied generated resources, without exposing their source
paths. A configured stylesheet pointing outside or into
`mokly-generated/` is `config-invalid`; an emitted reference to an unavailable,
unsafe, symlinked, non-regular, or protected target is `build-invalid` naming
the referring generated or authored document. Preserve normal source and
realpath protection even for files listed in the manifest.

Compute local hrefs from the **document's actual directory under**
`mokly-generated/` to the authored file under `mockupsDir`, using POSIX relative
paths, `/` separators, and URL-encoding per segment, preserving query and
fragment; for example `mokly-generated/home/index.mobile.html` to `styles.css` uses
`../../styles.css`. Resolve CSS references relative to the CSS file, not the
generated document. A generated-to-generated link resolves inside
`mokly-generated/`; no root-absolute catalogue hrefs. Disk-opened HTML and HTTP
URLs must resolve identically.

Serve maps `/static/mokly-generated/<route>` to the accepted in-memory compilation
except the private manifest (404), and `/static/<catalogue-relative closure path>`
to the live authored regular file;
unreferenced paths return not found. No filesystem fallback for generated
routes. Export ships those same compiled bytes under `mokly-generated/` plus only
the closure files at their catalogue-relative paths; static hosting mirrors
the disk URL layout. The merged viewer's required prefix, identity-derived
paths and catalogue-v5-only policy are in [generated delivery](./mokly-generated-delivery.md).
The export destination may neither contain nor be
contained by `mokly-generated/`, including resolved aliases, and must preserve
the existing source/cache/export transactional confinement rules.

## Replacement And Baseline Storage

Stage the **entire** `mokly-generated/` tree in an ignored sibling
`.mokly-write-mokly-generated-<random>/stage` directory on the same filesystem;
validate before moving the old tree to that transaction's `backup`, install
by renaming `stage`, and restore `backup` on an install failure. Reject
symlinks at or inside the old tree before moving it, and inside the stage;
never follow them or disturb the old tree on validation failure. Clean the transaction after install or rollback; a failed
rollback preserves its backup and reports the recovery path. If a crash leaves
no live tree but a sibling transaction with `backup`, the next build fails
`build-invalid` with `previous generated tree may be in <backup>; restore the backup or remove the leftover transaction before building`;
stage-only leftovers are ignored. If a live tree exists, old transaction
leftovers are ignored and left for manual cleanup, not adopted or removed.
Builds replace nothing outside `mokly-generated/` except their own sibling
transaction. There is no per-file refusal or orphan/unclaimed scan. Generated
HTML starts with `<!-- Generated by Mokly. Do not edit. -->` as one line;
comparison and Browse strip only this current first line, with LF or CRLF,
without using it as authority. Git index tracking is a prefix check, never a grep.

The merged baseline cache harvests only v9 generated output and its closure
under the recorded repository-relative catalogue root. Invalid and earlier-format caches are partial and are rebuilt under their lock.
No cache is read as flat content.
Discovery, addressing and the storage probe are defined in
[baseline addressing](./mokly-baseline-addressing.md).
Keep confinement, marker/lock validation, retention and extraction bounds.
