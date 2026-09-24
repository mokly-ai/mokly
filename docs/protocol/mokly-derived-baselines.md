# Per-Commit Baseline Selection

## Delivery Status

Approved target in [Generated Output Simplification](../../plans/generated-output-simplification.md).
The cached rebuild infrastructure and `preparing` state are shipped. Reader
selection is per commit, with v6 inventory verification and a dedicated
`.generated/` layout. Only `check` inspects head Git index tracking.

## Purpose And Configuration

The head side always uses the current validated **in-memory compilation**;
neither tracked nor untracked head output has to match local generated files
to compare. For every pinned merge-base commit independently, use complete
generated Git blobs if they exist, or rebuild that commit using its own
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

| Command                | Behavior                                                            |
| ---------------------- | ------------------------------------------------------------------- |
| `build`                | Transactionally replace `.generated/` without inspecting head index |
| `check`                | Validate; compare disk only if all expected output is indexed       |
| `serve`                | In-memory head; select base reader per commit, not head index       |
| `export` / publication | In-memory head; select base reader per commit, not head index       |

`check` reports `build-invalid` for sorted missing expected paths, stale
expected bytes, and extra files under `.generated/`, including an absent
directory, with both remedies: `mokly build` and commit the complete directory,
or `git rm -r --cached -- <mockupsDir>/.generated/` and ignore it. Empty
directories are not files and do not count as extras. Untracked `check` only
validates compilation and never reads local `.generated/` contents to judge
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

Resolve the merge base of `HEAD` and `review.base` (or explicit `--base`) once
and pin it. Look up the canonical manifest in that commit under
`<mockupsDir>/.generated/` first and the historical single `mockupsDir`
second; preserve former names and the opt-in v2 fallback only at the legacy
path. If none exists, rebuild the commit. For a v6 manifest, verify that the
listed generated paths and blob hashes match the full tree exactly, apart from
the separately validated manifest itself. Missing, mismatched, extra, or
non-regular paths trigger a rebuild and the exact informational diagnostic
in [generated output](./mokly-generated-output.md#manifest-v6-and-per-commit-baselines).
Historical manifests without inventory (v2–v5) retain the assumption that a
committed manifest implies complete output and use Git blobs; the first
missing blob on use still fails normally. A malformed manifest is an error,
not absence. Baseline selection is independent of whether today's compiled
output is tracked, whether the working tree contains local output, or whether
the baseline used the same directory layout. Do not use Git evidence as a
substitute for independent resource-byte comparisons.

Both reader implementations accept **commit and repository-relative path**;
the Git reader reads blobs. The rebuilt reader maps a v6 path directly beneath
the cache entry's `output/`, or removes only the historical `mockupsDir` prefix
for a flat legacy cache entry; it never uses the current config's mockups root.
Neither follows symlinks; both require regular files and enforce the same
4,096-object, 48 MiB per-batch limits, with at most 32 disk reads in flight.
The manifest's closure supplies the v6 authored asset paths for historical
reads. Current resources still use confined live files; differing closure
membership or bytes can make an otherwise unchanged view material even
without changed Git paths. Resource attribution and the unchanged-view fast
path remain governed by [component changes](./mokly-component-changes.md).
Per-commit selection supplies the
[baseline catalogue descriptor](./mokly-baseline-addressing.md#per-commit-descriptor):
pair documents by layout-relative logical route and authored resources by
catalogue-relative path on **each** side, never by repository-relative base
filename or changed-path evidence. This includes moved historical roots,
legacy blobs, flat cached rebuilds, and v6 rebuilt caches.

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
`/__mokly/diffs/review.json` fails `review-invalid` with
`The comparison is not prepared`. The parent retains one preparation for each
resolved commit and build settings. A ref move to a new merge base cancels
the old preparation, revokes the reader and prepares the new base; an unchanged
merge base only reclassifies. Content invalidation cancels classification, not
the shared build. Shutdown drains rebuild processes; superseded results are
discarded. A failed build can retry on a later generation.

Serve opens with `pending`; a cache hit proceeds directly to classification.
While actually rebuilding, show `preparing` in the Changes sidebar and then
`pending` during classification, followed by `ready` or `unavailable`.
Classification remains independent of the current output write policy. A
rebuild failure logs its typed error but does not expose commands or paths in
the sidebar. Navigation, reconnect and retained-state rules treat `preparing`
like `pending`. Lock waiters reusing another builder's result receive only
`complete`, not a spurious `preparing` event.

## Export, Diagnostics, And Acceptance

Export with comparison prepares and pins the baseline before capture; a
rebuild failure fails export, rather than showing zero Changes. The input
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
- Test v6 absent/complete/missing/mismatched/extra inventory at **each** base
  commit, transitions across tracking policies, and historical v5 comparison.
- Test cache hits, interruption, bounded command errors, path/symlink
  confinement, child handoff, and in-memory head comparisons.
- Test Serve's `preparing → pending → ready | unavailable` lifecycle, export
  pinning and explicit failure, and no writes outside the three opted-in
  commands.
