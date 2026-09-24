# Generated Output, Git State, And Asset Closure

## Delivery Status

Implemented contract for [Generated Output Simplification](../../plans/generated-output-simplification.md).
See
[configuration](./mokly-configuration.md), [baseline selection](./mokly-derived-baselines.md),
[baseline storage](./mokly-baseline-storage.md), and [terminal output](./mokly-terminal-output.md).

## Roots And Paths

`mockupsDir` is the catalogue directory. Its fixed, Mokly-owned child
`<mockupsDir>/.generated/` contains **only** generated documents/fragments and
`mokly-manifest.json`. No authored file belongs in this child. Route paths
inside it are relative POSIX paths; an HTML route `design/a.html` is stored at
`<mockupsDir>/.generated/design/a.html`. Authored assets stay at their original
paths below `mockupsDir`, including stylesheet-rule paths, which remain relative
to `mockupsDir`. Output, cache, and authored input paths must remain confined
under the configured repository root through both lexical and real paths.

Resolved entries, the renderer, compatibility transformer, module-resolution
package roots, and imported authoring sources may be under `mockupsDir`, but
not under `.generated/` (including through aliases). Explicit configured
inputs under `.generated/` fail `config-invalid` naming the setting and path;
discovered/imported ones fail `config-invalid` naming the source. A route or
closure reference that hits a protected source, symlink, directory, missing
file, or path outside the catalogue fails `build-invalid` with its referring
route. Never use `.gitignore` as evidence of tracked state.

## Tracked State And Commands

Only `check`, after a successful, complete compilation, enumerates index paths with
`git ls-files --cached --full-name -z` under the literal repository-relative
`.generated/` prefix (checking lexical and resolved aliases); exclude neither
ignored nor staged-for-removal paths by consulting `.gitignore`. Let `E` be
all compiled paths under `.generated/`, including the manifest, and `I` all
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
Run mokly build and commit every file under <mockupsDir>/.generated/, or run git rm -r --cached -- <mockupsDir>/.generated/ and add /<mockupsDir>/.generated/ to .gitignore.
```

`tracked` lists every indexed `.generated/` path (including extras); omit
`tracked:` if empty. `untracked` lists `E - I`; it cannot be empty in mixed
state. Render `<mockupsDir>` as a repository-relative POSIX path without `./`.
`check` computes the state once, after compilation, and compares disk only in
tracked state. `build`, `build --watch`, `serve`, `serve --build`, export and
publication do **not** compute tracking or run the cache index guard; no
watched generation refreshes it and no Serve child receives it. A comparison
still needs Git and a valid base independently of head tracking. For example,
adding an entry to a repository that commits `.generated/` must allow `build`
to write the new route; `check` then lists that route under `untracked:` until
it is staged (and then committed as part of the tracked-output workflow).
`build` cannot be blocked by its own remedy.

Only `build`, `build --watch`, and `serve --build` write generated output.
`build --watch` compiles/writes once, then reuses the consumer watcher and its
debounce and reload/rebuild/ignore classifications; a reload or config change
that affects compilation produces a new complete compilation. It writes only
after each **successful, fully validated** compilation and reports each
accepted build; a failure reports the error, retains the last successful tree,
and keeps watching. The watcher ignores `.generated/` and transactional
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

For tracked `check`, compare **every regular file** under `.generated/` with
the in-memory expected map by path and exact bytes. A missing tree makes all
expected files missing; an unexpected path, including a symlink or an empty
directory, is extra. If any mismatch exists, fail `build-invalid` with this exact text:

```text
generated output does not match source:
missing generated files:
  - <path>
stale generated files:
  - <path>
extra generated files:
  - <path>
Run mokly build and commit every file under <mockupsDir>/.generated/, or run git rm -r --cached -- <mockupsDir>/.generated/ and add /<mockupsDir>/.generated/ to .gitignore.
```

Print only nonempty groups in that order with catalogue-relative POSIX paths
sorted within each group (prefixed `.generated/`); never print placeholders.
On success the plain summary is `Mokly output is current (<n> files).` for
tracked and `Mokly output is valid and untracked (<n> files).` for untracked,
where `<n>` includes the manifest. `build` prints `Generated <n> Mokly files.`
after every successful transaction. Rich equivalents and watched reporting
are specified in [terminal output](./mokly-terminal-output.md).

## Manifest V6 And Per-Commit Baselines

The current canonical manifest has `schemaVersion: 6`, retains v5 fields and
adds:

```ts
assetClosure: string[]; // sorted, unique catalogue-relative POSIX file paths
generatedFiles: { path: string; blobHash: string }[]; // sorted by path
blobHashAlgorithm: "sha1" | "sha256";
```

`generatedFiles` inventories **every generated file except the manifest
itself**; a manifest cannot contain its own Git blob hash without a circular
dependency. The manifest's presence and schema are checked separately. Each
`path` is relative to `.generated/`, never a closure file; generated HTML and
fragments are included. `blobHash` is the lowercase hex digest of
`<algorithm>(UTF8("blob " + byteLength) || 0x00 || exact UTF-8 file bytes)`;
choose the repository's Git object format (`git rev-parse --show-object-format`),
defaulting to `sha1` without Git. Require 40 hex digits for SHA-1 or 64 for
SHA-256. This is Git's blob-object ID, **not** a digest of the path or rendered
string. Validate uniqueness, sorting, safe confinement, algorithm and format
at parse time. The resulting serialized manifest has canonical deterministic
ordering. Readers of v2 (only with the existing compatibility switch), v3,
both disjoint v4 forms, and v5 continue to work for historical comparisons;
current live output requires v6.

For **each pinned merge-base commit**, inspect its tree once with `git ls-tree`
and look first for `<current repo-relative mockupsDir>/.generated/mokly-manifest.json`,
then for `<current repo-relative mockupsDir>/mokly-manifest.json`. When the
canonical path is absent, historical `mokabook-manifest.json` and the opt-in
v2 `mockbook-manifest.json` fallback remain at the legacy root; never override
an existing but invalid canonical manifest with an older name. No manifest
at those locations means **rebuild** using the base commit's own configured
install/build recipe. A moved `mockupsDir` also rebuilds when the current root
has no manifest. Deterministic discovery of the historical root and its cache
descriptor is specified in [baseline addressing](./mokly-baseline-addressing.md).

For v6, compare the tree's regular blob paths **exactly** with
`generatedFiles` plus the manifest path, comparing each blob ID with its
inventory hash. Missing, extra, non-regular, or mismatched blobs mean
**rebuild** with an informational diagnostic before running the recipe.
For v5 and earlier, retain the historical rule that a committed manifest is
assumed complete and read its Git blobs; no inventory is fabricated for it.
If the manifest is malformed, report `manifest-invalid` rather than silently
trusting it. A Git read failure is not evidence of absent output. The head
side of a comparison always uses validated, in-memory compilation; it never
requires working-tree output to match. Baseline reader selection is per
commit, never based on the head tracking state.

Emit the following **info-level stderr diagnostic** only when inventory
verification requests a rebuild (for normal CLI, watched Serve parent, and
export/publication comparison preparation), with sorted generated-root-relative
paths, using the first applicable reason in missing, mismatched, extra order
(a non-regular path is missing for this purpose):

```text
Mokly baseline <commit>: rebuilding because generated output is missing: <comma-separated paths>.
Mokly baseline <commit>: rebuilding because generated output has mismatched blob hashes: <comma-separated paths>.
Mokly baseline <commit>: rebuilding because generated output has extra files: <comma-separated paths>.
```

No-manifest rebuilds need no inventory diagnostic. Do not log secrets or
expose these diagnostics in the Browse shell. Baseline rebuilds execute trusted
historical code only; `review.baselineBuild` remains available regardless of
head tracking. See [baseline selection](./mokly-derived-baselines.md).

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
public files merely because they share a directory. Assets outside
`mockupsDir`, including CSS imported directly from React components, are not
supported by this contract. A configured stylesheet pointing outside or into
`.generated/` is `config-invalid`; an emitted reference to an unavailable,
unsafe, symlinked, non-regular, or protected target is `build-invalid` naming
the referring generated or authored document. Preserve normal source and
realpath protection even for files listed in the manifest.

Compute local hrefs from the **document's actual directory under**
`.generated/` to the authored file under `mockupsDir`, using POSIX relative
paths, `/` separators, and URL-encoding per segment, preserving query and
fragment; for example `.generated/design/a.html` to `styles.css` uses
`../../styles.css`. Resolve CSS references relative to the CSS file, not the
generated document. A generated-to-generated link resolves inside
`.generated/`; no root-absolute catalogue hrefs. Disk-opened HTML and HTTP
URLs must resolve identically.

Serve maps `/static/.generated/<route>` to the accepted in-memory compilation,
and `/static/<catalogue-relative closure path>` to the live authored regular file;
unreferenced paths return not found. No filesystem fallback for generated
routes. Export ships those same compiled bytes under `.generated/` plus only
the closure files at their catalogue-relative paths; static hosting mirrors
the disk URL layout. The public viewer's optional prefix signal and old
publication compatibility are in [generated delivery](./mokly-generated-delivery.md).
The export destination may neither contain nor be
contained by `.generated/`, including resolved aliases, and must preserve
the existing source/cache/export transactional confinement rules.

## Replacement And Legacy Storage

Stage the **entire** `.generated/` tree in an ignored sibling
`.mokly-write-.generated-<random>/stage` directory on the same filesystem;
validate before moving the old tree to that transaction's `backup`, install
by renaming `stage`, and restore `backup` on an install failure. Never follow
symlinks at or inside the old or staged tree; reject them without disturbing
the old tree. Clean the transaction after install or rollback; a failed
rollback preserves its backup and reports the recovery path. If a crash leaves
no live tree but a sibling transaction with `backup`, the next build fails
`build-invalid`, names that backup, and requires manual restoration or removal;
stage-only leftovers are ignored. If a live tree exists, old transaction
leftovers are ignored and left for manual cleanup, not adopted or removed.
Builds replace nothing outside `.generated/` except their own sibling
transaction. There is no per-file refusal or orphan/unclaimed scan. Generated
HTML starts with `<!-- Generated by Mokly. Do not edit. -->` as one line;
comparison and Browse strip this or a historical ownership first line without
using either as authority. Git index tracking is a prefix check, never a grep.

For v6 baseline cache entries, harvest `.generated/` and the manifest closure
under their repository-relative catalogue path; for legacy entries, keep the
flat `output/` layout. The precise discovery, recorded root, reader mapping,
and pre-v6 cache compatibility are in [baseline addressing](./mokly-baseline-addressing.md).
Keep confinement, marker/lock validation, retention and extraction bounds.
