# Rebuilt historical baselines

This internal module reproduces generated output using the merge-base commit's
own code and dependencies. Rebuilding executes trusted mainline code. It is not
a sandbox and must run outside HTTP requests. Public consumers configure the CLI;
this directory adds no supported JavaScript package exports.

`BaselineBuilder` in `types.ts` accepts `build(request)`, where the request names
one resolved commit, repository root, repository-relative `mockupsPath`, exact
argv commands, optional historical-v2 compatibility, and an `AbortSignal`.
`CachedBaselineBuilder(fs, runner, clock, maintenance, options)` implements it
with four injected collaborators: filesystem, process runner, clock and
`BaselineMaintenanceReporter`. The Node implementations live in `filesystem.ts`,
`process.ts`, `clock.ts` and `maintenance.ts`. `review/prepare.ts` supplies
`StderrBaselineMaintenanceReporter` at the production composition root; unit
tests record structured maintenance failures through an injected fake.

```ts
const prepared = await builder.build({
  repoRoot,
  commit,
  mockupsPath: "docs/mockups",
  commands: [
    ["npm", "ci"],
    ["npm", "run", "mockups:build"],
  ],
  signal,
  onProgress(event) {
    // Publish preparation state; keep typed diagnostics outside product copy.
    if (event.type === "start") preparing(event.commit);
    if (event.type === "complete") completed(event.commit, event.cacheHit);
    if (event.type === "fail") failed(event.commit, event.error);
  },
});
```

The observer is synchronous and must not throw. A cache hit emits only
`complete` with `cacheHit: true`; only a confirmed miss emits `start`, followed by
`complete` or `fail`. Waiters emit only `complete` with `cacheHit: true` after sharing
another caller's rebuild. Await `build()` to include lock release and cleanup.
Callers should keep their own sequence/commit guard to ignore superseded events.
Abort the request and await settlement before terminating a worker or shutting
down its host. With `--debug-timings`, `baseline.resolve` measures commit
resolution before the parent `baseline` builder span. The builder emits
`baseline.extract`, `baseline.command[<index>]` and `baseline.adopt` child spans
on a miss. Its successful end includes a boolean `cacheHit`; it settles only
after best-effort cleanup and lock release. Command argv and diagnostics never
enter timing records. See the [timing contract](../../docs/protocol/mokly-timings.md).

Preparation lives in `review/prepare.ts`; read-only factories live separately
in `review/repository.ts`:
`prepareReviewRepository(config, base, { signal, onProgress })` creates the Node
builder or committed reader and returns a pinned repository. Serve's
`BackgroundGeneration` uses a retained `BackgroundBaseline` in the parent after output adoption and before
`BackgroundCompilation.classify(base, commit)`. The classification worker reads
the cache and its accepted compiled head output; it cannot start a rebuild.
`BackgroundBaseline` passes an observer at that parent call that publishes the
`preparing` evidence state on `start` and returns to `pending` on `complete`, so
a cache hit never leaves `pending`. A rejected build reaches the shared error
path, which logs the typed reason and publishes `unavailable`. Export uses the
same composition and rechecks the marker.
Content invalidation cancels the classification wait without cancelling the
commit's build. Ref changes reuse preparation when the merge base is unchanged;
a changed commit or build settings and shutdown cancel and drain it.

`cache_layout.ts` owns `.mokly-cache/baselines/<commit>`. The builder extracts
to `source`, runs commands, validates the historical manifest and output tree,
moves the generated directory to `output`, deletes the extraction, and writes
`complete.json`. Completion of the marker write commits the result immediately.
Cancellation before that point removes partial output; cancellation afterward
returns the completed result and skips remaining retention work. Cleanup and
lock release cannot reject or erase a completed build. No cleanup failure may
replace an existing typed build error or its command diagnostics; partial-entry
removal still attempts lock release if it fails. `cleanup.ts` returns per-entry
maintenance failures and continues with other eligible entries. The maintenance
reporter receives each entry and original error without adding failure events
to a successful build. Its `report(failure)` method must not
throw; the stderr implementation tolerates a closed diagnostic stream.
`inputs.json` records the repository-relative output path;
the marker records the commands. A complete entry for different settings fails
explicitly and remains intact. Remove that commit's cache entry before changing
its catalogue/build settings. Partial entries are rebuilt under the entry lock.

Lock publication uses a fully written temporary file and an exclusive hard link.
The filesystem captures the temporary file's identity before publication and
returns that identity as ownership; callers perform no fallible metadata read
between publication and receiving their release handle. Temporary-file cleanup
reports through the injected maintenance reporter without changing successful
ownership, contention, or the original publication error.
Dead-holder reclamation retains an identity-specific hard-link tombstone so
simultaneous stale observers cannot unlink a replacement lock. Waiters poll every
100 ms for at most two minutes by default. Cleanup retains three completed
commits by default, always keeping the active entry and skipping locked entries.
Retired entries are moved beneath the active locked entry before removal.
All builder calls acquire the lock before reuse. They sweep discarded output
and dead-owner temporary lock files, including on cache hits. Tombstones and
legacy temporaries without owner identity remain until entry retirement.

`archive.ts` uses the tar parser without its filesystem extractor, validates all
paths and symlink chains before writing, and rejects hard links, device files,
cycles and traversal through symlink ancestors. Git archives are uncompressed
and bounded to 64 MiB and 65,536 entries. The parser reuses input and
single-chunk entry buffers. The runtime `tar` dependency supplies its mature
parser; implementing a second archive parser would duplicate security-sensitive code.
Commands run without a shell and receive only the documented directory,
locale, network and executable-lookup variables, CI=1 and MOKLY_BASELINE_COMMIT.
`executable.ts` resolves Windows npm/npx in working-directory, PATH and PATHEXT
order. Native `.exe`/`.com` launchers run directly; only the selected `.cmd`
shim is translated to its installation's JavaScript entry point. Explicit
`.cmd` paths remain explicit. Unsupported selected launchers fail instead of
falling through to a different installation. Arguments remain literal. Combined diagnostics
retain at most 64 KiB; command errors expose the last 40 lines and a zero-based
command index, argv, exit code and signal. `process_scope.ts` owns command
lifecycle: POSIX uses process groups with TERM then KILL; Windows uses a native
kill-on-close Job Object through the existing Koffi bridge. `process_worker.ts`
waits for the parent's release until the POSIX group is registered with an
inherited verification owner, when present, and Windows job assignment succeeds.
Commands therefore cannot start descendants before ownership is established.
Job termination does not depend on the launcher's PID remaining alive. Disposal
waits for zero active job processes and closed output pipes, and also stops
silent background descendants after normal command completion. Missing native
support, process-registration failure or job-assignment failure each stops
historical code before it starts; there is no child-only fallback.

`RebuiltBaselineReader(fs, repoRoot, outputDir, commit, mockupsPath, signal?)`
reads only a completed output tree. Its `BaselineReader` API retains
repository-relative paths and the pinned commit; it strips the output prefix
internally. It rejects symlinks at every ancestor and non-regular files. Bulk
reads use the Git reader's 4,096-object / 48 MiB batch limits, with at most 32
filesystem reads in flight. The review asset reader additionally applies the
historical manifest's source inventory and reserved-name policy.

```bash
npm run build
node --import tsx --test tests/baseline*.test.ts
```

Unit tests use an in-memory filesystem, fake process runner and clock. The real
Git integration fixture exercises extraction, execution, cache sharing, recovery,
interruption and symlink rejection. See the
[derived-baseline contract](../../docs/protocol/mokly-derived-baselines.md)
and [storage and execution rules](../../docs/protocol/mokly-baseline-storage.md)
and [review boundaries](../review/README.md).

`baseline_process_tree.test.ts` runs real nested commands on Linux and in the
Windows/macOS CI jobs, including cancellation after the launcher exits. Native
binding fault tests exercise assignment, setup and ownership ordering without
requiring a Windows host.
The Windows fixture detaches its descendant from Node's automatic
kill-child-on-parent-exit relationship. It must still belong to Mokly's enclosing
job; otherwise the fixture would exit automatically before testing cancellation.
