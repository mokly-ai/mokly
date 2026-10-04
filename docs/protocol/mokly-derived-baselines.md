# Per-Commit Baseline Selection

## Delivery Status

Only v8 baselines are readable. Per-commit selection, rebuilds and `preparing`
apply the [v8 version gate](./mokly-generated-manifest.md) before creating a reader.
Only `check` inspects head Git index tracking. Implementation and verification
are tracked by [Generated Output Simplification](../../plans/generated-output-simplification.md).

## Purpose And Configuration

The head side always uses the current validated **in-memory compilation**;
neither tracked nor untracked head output has to match local generated files
to compare. For every pinned merge-base commit independently, first reject
recognized earlier output with `main`'s expected unavailable outcome. Otherwise
use complete v8 generated Git blobs, or rebuild that commit using its own
lockfile, dependencies, config, entries, renderer, and Mokly version. A change
in tracking policy across history does not change this rule. Neither HTTP
request paths nor disposable Serve children may run the baseline build.

`review.baselineBuild` is an optional, ordered list of argv arrays executed
without a shell in the extracted baseline root, valid in **every** repository.
Every argv is nonempty, starts with a nonblank executable, and contains only
strings without NUL. The default is `["npm", "ci"]` followed by
`["npx", "--no-install", "mokly", "build", "--config", <repository-relative config path>]`.
Consumers that must compile their own tool first specify the entire recipe;
Mokly appends no implicit commands. An explicit empty list is valid only if
the historical extraction already contains usable output. This repository's
example specifies `npm ci`, `npm run build`, then `npm run example:build`.
The historical catalogue may have a different `mockupsDir`; a rebuild finds
the historical output, and does not use the current config to reinterpret it.

**Trust:** a rebuild executes historical code. Set `review.base` to a trusted
mainline whose scripts are already trusted in CI; an untrusted branch may
execute arbitrary scripts during preparation. Tracking generated output at
the head does not remove this risk if a historical commit lacks complete
output. Prefer a trusted base rather than relying on the current Git state.

## Command Behavior

Only `check` reads head tracked state from the **index**, never `.gitignore`,
once after its complete compilation; without Git, `check` treats it as
untracked. The precise mixed-state error and prefix rules are in
[generated output](./mokly-generated-output.md#tracked-state-and-commands).

| Command                | Behavior                                                                 |
| ---------------------- | ------------------------------------------------------------------------ |
| `build`                | Transactionally replace `mokly-generated/` without inspecting head index |
| `check`                | Validate; compare disk only if all expected output is indexed            |
| `serve`                | In-memory head; select base reader per commit, not head index            |
| `export` / publication | In-memory head; select base reader per commit, not head index            |

`check` reports `build-invalid` for sorted missing expected paths, stale
expected bytes, and extra files under `mokly-generated/`, including an absent
directory, with both remedies: `mokly build` and commit the complete directory,
or `git rm -r --cached -- <mockupsDir>/mokly-generated/` and ignore it. Unexpected
empty directories count as extra paths. Untracked `check` only
validates compilation and never reads local `mokly-generated/` contents to judge
freshness. Indexed `.mokly-cache/` files remain invalid regardless of head
state. Only `check` rejects partly tracked output; `build` writes regardless
of tracking. Adding a new entry to a committed catalogue therefore builds
successfully, then `check` lists its unstaged route under `untracked:` until
it is staged. The exact terminal summaries are in
[terminal output](./mokly-terminal-output.md).

Only `build`, `build --watch`, and `serve --build` may write the generated
tree. Watched writes occur only after each successful, complete compilation;
failed generations retain the previous tree. Plain Serve, export, publication,
HTTP demand generation, and baseline selection never write head output. See
[generated output](./mokly-generated-output.md#tracked-state-and-commands)
for debounce, one-shot and child/parent behavior.

### Selecting The Base Reader

Resolve and pin the merge base once. List only the requested generated
subtree and inspect its canonical `mokly-manifest.json`. Ignore committed
root-level and noncanonical filenames. A complete v8 inventory selects Git
blobs; missing or incomplete output selects the base's own recipe. Keep the
version gate on a selected current-location manifest and normal I/O errors.

After the rebuild, a canonical root-level manifest below v8 returns
`baseline-incompatible-earlier`. A current generated manifest takes precedence.
Do not cache earlier output or its outcome. Invalid, missing or older cached
entries are partial and are deleted under the cache lock before rebuilding.
No head-index state participates in these decisions.

Both readable implementations accept a commit and repository-relative path.
The Git reader reads blobs. The rebuilt v8 reader appends that path beneath
its cache `output/`, using the pinned historical root. There is no flat legacy
reader. Keep regular-file/symlink checks, 4,096-object and 48 MiB batch bounds,
and at most 32 disk reads in flight. Authored resources come from the v8
closure; generated CSS and opaque assets come from its verified inventory.

Both sides are v8. Pair documents by kind/id and view axes; address generated
resources relative to each generated root and authored resources relative to
each catalogue root. Preserve moved-root handling, independent byte/membership
checks, CSS attribution and component fast paths. Remove only old-schema
conversion and cross-layout URL normalization, not ordinary URL parsing or
source/dependency evidence. See the
[descriptor contract](./mokly-baseline-addressing.md#comparison-namespaces).

### Earlier-Baseline Availability

Preserve `main`'s typed outcome for every pre-v8 base. Serve keeps All usable
with Changes unavailable and no changed/removed entries, comparisons or previous
versions. Export and Changes-enabled publication succeed with current content,
`changesStatus: "unavailable"`, `comparisonUrl: null`, and no historical files.
Publication without Changes stays disabled and performs no baseline work.

Print exactly once per rejected pinned base:

```text
Changes are unavailable because the comparison base was built with an earlier version of Mokly. Changes will return once the base includes this version.
```

Retain the outcome for unchanged content generations; do not repeat the line or
rebuild. A new base can restore Changes through normal preparation. A v8 source
failure or invalid/newer baseline does not receive this graceful exception.

## Preparation And Serve

The [baseline storage contract](./mokly-baseline-storage.md) owns extraction,
process cancellation, command environment, cache locking, adoption, retention,
and crash cleanup. A missing or incomplete base builds **before** Serve's
classification or export capture, not during an HTTP request. The CLI, export,
publication and watched Serve parent create `PreparedReviewRepository` for a
pinned commit, handing only read-only evidence and reader capabilities to
classification. The Serve child never selects a new baseline or writes output.
No-Git Serve may still browse without Changes; comparison requires a Git base.

The parent sends `baselineCommit` in a versioned update IPC message before
classification. Omission retains the reader; `null` revokes it while a new
base prepares; stale update versions cannot restore an old commit. The child
opens the already-selected read-only Git or cache reader; `--no-watch` uses
the same handoff without IPC. Until handoff, unselected
`/mokly-viewer/diffs/review.json` fails `review-invalid` with
`The comparison is not prepared`. The parent retains one preparation for each
resolved commit and build settings. A ref move to a new merge base cancels
the old preparation, revokes the reader and prepares the new base; an unchanged
merge base only reclassifies. Content invalidation cancels classification, not
the shared build. Shutdown drains rebuild processes; superseded results are
discarded. A failed build can retry on a later generation.

Serve opens with `pending`; a cache hit proceeds directly to classification.
While actually rebuilding, show `preparing` in the Changes sidebar and then
`pending` during classification, followed by `ready` or `unavailable`.
Classification remains independent of the current output write policy. An earlier base becomes unavailable under the typed policy above; any other
rebuild failure logs its typed error but does not expose commands or paths in
the sidebar. Navigation, reconnect and retained-state rules treat `preparing`
like `pending`. Lock waiters reusing another builder's result receive only
`complete`, not a spurious `preparing` event.

## Export, Diagnostics, And Acceptance

Export with comparison prepares and pins the baseline before capture; a
rebuild failure fails export, except for the explicit earlier-version outcome
above; neither outcome is a successful zero-Changes comparison. The input
recheck confirms the completion marker still names the pinned commit and
has not changed. Publication with Changes behaves the same; default
publication without Changes needs no baseline. Both capture current generated
bytes from memory and authored closure files from confined disk reads.

`--debug-timings` retains `baseline.resolve`, `baseline.extract`,
`baseline.command[<index>]`, and `baseline.adopt`; the parent baseline span
reports `cacheHit` on successful completion. Warm hits omit command and
adoption spans. The large fixture benchmarks cold and warm rebuilds by
choosing a commit without complete tracked output; it no longer has a mode
flag. Navigation targets and `preparing → pending` timing remain measurable.

- Test tracking outcomes (including no Git), mixed-state path guidance,
  tracked missing/stale/extra output, and untracked local-output independence.
- Test v8 absent/complete/missing/mismatched/extra inventory at **each** base
  commit, tracking transitions and moved v8 roots; test v2–v7 incompatibility
  at the selected generated location and after a rebuild, plus once-per-base
  reporting and v8 recovery. Prove stale committed root-level v7 and invalid
  caches rebuild rather than deciding unavailability.
- Test cache hits, interruption, bounded command errors, path/symlink
  confinement, child handoff, and in-memory head comparisons.
- Test Serve's `preparing → pending → ready | unavailable` lifecycle, export
  pinning and explicit failure, and no writes outside the three opted-in
  commands.
