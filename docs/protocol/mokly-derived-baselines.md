# Derived Baselines

## Delivery Status

Implemented by the completed
[derived baselines plan](../../plans/derived-baselines.md). Separate readers,
the cached builder, configuration, build/check modes, Serve/export preparation,
the `preparing` presentation, the commit-scoped watch lifecycle, detailed
rebuild timings, and the derived scale fixture are shipped.
Source-path-free classification with historical v3–v5 normalization is planned
by [remove-source-path-evidence](../../plans/remove-source-path-evidence.md)
and implemented in Milestones 4 and 6; rebuilt current v6 baselines are cached
without downgrading their manifests.

## Purpose

Committed generated output gives Changes, comparisons, and export a baseline
that is read from Git without executing anything. Its cost is that every
source edit also changes generated files, which conflict on merge even though
the only correct resolution is regeneration. Derived mode removes generated
routes and the manifest from Git and instead reproduces the baseline from the
merge-base commit itself, with that commit's own dependencies and Mokly
version, cached per commit. Source stays the only authored artifact.

Derived mode changes where baseline bytes come from. It never renders a
historical commit with the current tree's config, entries, renderer, or
Mokly package, and it never rebuilds the baseline on an HTTP request path.

## Configuration

```ts
interface MoklyConfig {
  generatedOutput?: "committed" | "derived"; // "derived"
  review?: {
    baselineBuild?: readonly (readonly string[])[];
  };
}
```

`generatedOutput` selects the mode for every command. `derived` is the default;
`committed` remains an explicit compatibility mode. Unknown strings are config
errors.

`review.baselineBuild` is an ordered list of argv arrays executed in the
extracted base commit's root, in order, without a shell. Each array is
non-empty; the first element is the executable. It is valid only in derived
mode; setting it in committed mode is a config error. The default is an npm
clean install followed by the Mokly build for the same repository-relative
config path as the current run. Consumers whose base commit must first compile
their own tooling, such as this repository's example, list those commands
explicitly. Mokly never appends implicit commands after an explicit list.
The exact defaults are `["npm", "ci"]`, then `["npx", "--no-install",
"mokly", "build", "--config", <repository-relative config path>]`.
Arguments must be strings without NUL; the executable must not be blank.
An explicit empty command list is allowed when the archived tree already has
valid output. Derived `mockupsDir` must be below `repoRoot`; it may be absent
in a fresh checkout. Existing ancestors and symlinks remain confined.
The repository example uses the default derived mode with `npm ci`,
`npm run build`, and `npm run example:build` as its explicit recipe.
Generated HTML and the manifest are ignored; authored public CSS remains tracked.
Committed mode never accepts inert commands.

## Trust Statement

Rebuilding executes code from the merge-base commit: its lockfile, package
scripts, config module, entries, and renderer. Derived mode is appropriate
only when the configured base ref is a trusted mainline the consumer already
runs in CI. A consumer that compares against untrusted branches must stay in
committed mode. The documentation for the option states this plainly.

## Command Behavior By Mode

| Command     | Committed                            | Derived                                                  |
| ----------- | ------------------------------------ | -------------------------------------------------------- |
| `build`     | Transactional write to `mockupsDir`  | Same; output is a local artifact, not a commit candidate |
| `check`     | Expected bytes equal committed bytes | Validate compilation; fail if output is Git-tracked      |
| `serve`     | Baseline read from Git blobs         | Baseline from the cache, `preparing` while rebuilding    |
| `export`    | Baseline read from Git blobs         | Rebuild synchronously before capture, then export        |
| Publication | As export                            | As export                                                |

Build validation, ownership headers, manifest schema, source protection, and
route collision rules are identical in both modes. Derived mode does not weaken
any validation; it only changes the baseline source and the `check` comparison.

### Derived check

`check` compiles and validates exactly as in committed mode, then lists the
files Git tracks under `mockupsDir`, intersects them with the compiled routes
plus the manifest and indexed ownership headers for retired generated HTML,
and fails with a typed `build-invalid` error naming each
tracked path when the intersection is non-empty. The message suggests ignore
rules for the listed paths. Consumer-authored public files below `mockupsDir`,
including hand-written HTML without an ownership header, stay tracked and are
never reported. Derived `check` does not require the on-disk generated files to
exist or to match; the working tree copy is a local artifact.
Retired output is recognized only by an exact ownership header on the first
line naming a source below this catalogue's entries root. Header-like text
inside authored documents does not establish ownership. Git grep scans the
index without requiring working-tree files; only its no-match exit status is
accepted as empty evidence. Other Git failures remain `build-invalid`.
Tracking is read from the Git index with NUL-delimited names, including both
logical and physical output-root paths. Cache paths fail independently of the
compiled route set. Diagnostics include `git rm --cached` and ignore rules.

### Head side

In both modes the head side of a comparison is the current compilation's
validated output. Committed mode additionally requires that output to equal
the working tree, as today. Derived mode never reads head bytes from the
working tree.
Authored public resources still use confined current reads. Derived membership
compares every current generated document, plus reachable resource bytes, even
when Git has no corresponding output-path evidence. Accepted generated bytes
are retained privately across classification and selected comparisons; they
are not exposed in shell metadata.
Component resource-byte differences without a changed Git path use a `material`
reason; `changedPaths` and `dependency` reasons retain actual Git evidence.
The same reachable-resource byte comparison gates the
[unchanged view decision](./mokly-component-changes.md#unchanged-view-decision):
a view with identical normalized documents still takes the complete comparison
when independently discovered historical and current resource closures differ,
or when any resource present on both sides has different bytes, even without
Git evidence. For views with instances, styles, or entry-owned slots, the same independent
closure and byte proof also applies to ownership-projected documents; actual and
projected memberships are compared separately.

## Preparation And Storage

The [baseline storage and execution contract](./mokly-baseline-storage.md)
defines extraction limits, command environments, Windows npm/npx execution,
cache locking, adoption, retention and safe crash cleanup.

## Baseline Reads

`RebuiltBaselineReader` implements the same reader interface as the Git blob
reader over `output/`. The interface accepts commit and repository-relative
paths, strips the configured `mockupsDir` prefix, and confines the result to
`output/`. Files must resolve to regular files; symlinks, directories, and escapes are
rejected exactly as symlink and non-regular Git blobs are. Bulk reads batch
filesystem access (at most 32 reads in flight) and use the same 4,096-object
and 48 MiB per-batch budgets as committed reads, including metadata overhead.
Source protection applies the baseline's own manifest inventory, entry source
paths, and reserved basenames, as for any historical manifest.

## Serve And Watch

Serve in derived mode starts HTTP and adopts complete generated output exactly
as in committed mode. The parent owns preparation and its abort controller;
the disposable classification worker receives the prepared commit and compiled
head output. `PreparedReviewRepository` is constructed only at the CLI,
export/publication and Serve-parent composition boundary; it carries the pinned
commit, evidence, reader and completion marker. HTTP-reachable comparisons and
classification accept `ReadOnlyReviewRepository` (evidence and reader only),
with no implicit preparation fallback or import path to the builder.

After preparation, the parent sends `baselineCommit` in the existing versioned
`update` IPC message, before classification. The child opens the cached reader
through `baselineReaderForCommit` and injects it into its unselected comparison
provider. Omission retains the reader; `null` revokes it while a replacement is
prepared. Ref moves revoke and replace the reader; stale update versions cannot
restore an old commit. Before the first handoff and while revoked, unselected
`/__mokly/diffs/review.json` fails with `review-invalid` and the message
"The comparison is not prepared", without starting commands. Committed mode
may construct its read-only Git reader locally. Single-process `--no-watch`
Serve uses the same reader handoff without IPC. The builder never runs inside
a worker that can be terminated without draining its processes. The evidence state while a rebuild actually
runs is `preparing`: the count slot shows the spinner and selecting Changes
shows the preparing sidebar with product copy, distinct from the `pending`
classification state that follows. All remains available. Serve opens in
`pending`, because whether the commit is already cached is only known once the
builder has consulted the cache; a cache hit therefore never leaves `pending`.
A rebuild failure publishes `unavailable` with the existing sidebar
presentation; the typed error reason is logged, not shown in the sidebar.

Watched Serve observes ref changes as today. When the merge base moves, the
supervisor cancels a running rebuild, publishes `preparing` for the new commit,
and starts a new rebuild. Ref changes that leave the merge base unchanged do
not rebuild; they reclassify as today. `--no-watch` resolves the baseline once.
Content updates during `preparing` keep the state; the rebuild is independent
of the current generation. Late results for a superseded commit are ignored.
The parent retains one preparation per resolved commit and build settings;
content invalidation cancels classification and its wait, not the shared build.
Changed build settings, missing history and shutdown revoke the reader and
drain preparation. A failed build may be retried by a later generation.

The evidence state machine is `preparing → pending → ready | unavailable`, with
`preparing` omitted on a cache hit or in committed mode. Returning to `pending`
when the rebuild settles is part of that sequence, so classification always runs
under `pending`. Live evidence updates, retained navigation state, and reconnect
rules apply to `preparing` exactly as they apply to `pending`. The owning
mockups are recorded in the [shell design](./mokly-shell-design.md).
Lock waiters that reuse another builder's result receive only `complete`,
without a `start` event or a spurious preparing state.

## Export And Publication

Export resolves and pins the merge base, then runs the rebuild to completion
before capturing head input. A rebuild failure fails the export with the typed
reason; export never emits a zero Changes count or disables controls because
the baseline could not be prepared. Its input recheck verifies the completion
marker still names the pinned commit and has not changed; missing or invalid
markers fail without installing the export. Derived capture and its recheck use
compiled generated bytes and confined authored public resources. Publication with Changes follows the same
rules; default publication without Changes needs no baseline in either mode.

## Diagnostics

`--debug-timings` adds `baseline.resolve`, `baseline.extract`,
`baseline.command[<index>]`, and `baseline.adopt` phases, with a `cacheHit`
boolean on successful ends of the parent `baseline` builder phase. Resolution
precedes that phase; the builder span includes cache validation, lock waiting,
rebuilding and cleanup. Warm hits omit extraction, command and adoption spans.
The large fixture has a `--derived` variant
whose benchmark records both a cold-cache and a warm-cache Serve start; the
benchmark asserts the existing five-second navigation target for both and
records the separate time to a complete `preparing → pending` transition.
The benchmark uses builder timings even before Serve publishes `preparing`.

## Acceptance

- Config parsing rejects unknown `generatedOutput` values and `baselineBuild`
  in committed mode.
- Derived `check` fails on tracked generated routes, the manifest, and cache
  contents, listing exact paths, and passes for tracked authored public files.
- Cache hit runs no command; concurrent builders of one commit share a lock;
  a dead lock holder is reclaimed; interrupted entries leave no marker.
- Command failure reports index, argv, exit status, and bounded output.
- Extraction rejects escaping paths and outward symlinks.
- Reader rejects symlinks and escapes identically to the Git reader.
- Serve publishes `preparing`, then `pending`, then a terminal state; a merge
  base move cancels and restarts; a failure is `unavailable` with no leak of
  command or path detail into the sidebar.
- Export fails explicitly on rebuild failure and pins one commit throughout.
- Committed mode behavior is byte-identical to before this contract.
