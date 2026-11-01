# Keep compiled sidecar bundles across restarts

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the closed "perf 7" workspace of the
  performance work, and its unmerged plan at commit `0677f609` on branch
  `conductor/perf-7-disk-cache-for-sidecar-bundles-and-descriptions`.
- **Location:** `crates/mokly-sidecar/src/pool_requests.rs`,
  `crates/mokly-render/src/bundle_attempt.rs`,
  `packages/mokly/src/sidecar/compiled.ts:122`,
  `packages/mokly/src/sidecar/resolution-inputs.ts`, and
  `crates/mokly-compare/src/cache_types.rs:13`.
- **Reason:** The user has not answered the nine open decisions of the
  plan, and the plan starts no implementation before the answers.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Sidecar pool:** the core's Node process pool in `crates/mokly-sidecar`.
    It sends every request and keeps each compiled bundle in memory.
  - **Compiled recipe:** the private part of a `bundle` result: the code,
    the module graph, the consumed input digests, and the directory lists.
  - **`reuse` check:** the sidecar function in `compiled.ts` that accepts an
    earlier recipe when the settings, the roots, and every consumed input
    are equal.
  - **OS cache directory:** the per-repository directory outside the
    repository that holds the base extraction and dependency caches.
  - **Toolchain identity:** one digest of the Mokly, esbuild, and Node
    versions and of the sidecar's own program files.
- **Background:**
  - On each Serve start and each `build`, the sidecar compiles every
    JavaScript entry with esbuild. Nothing survives a restart. The base side
    of the first Changes classification compiles again.
  - On 2026-10-30, `main` at `f93afcea` on a slow machine took 6.6 s to a
    warm `serve.ready`. Of that, the head bundle took 2.8 s, the CSS
    Modules class maps 1.5 s, and `sidecar.describe` 0.26 s. The base bundle
    took 3.2 s. The baseline machine measured `serve.ready` at 4.2 s. The
    user's startup target is about 1 s.
  - The task of the closed workspace set these requirements:
    - A warm restart of `examples/basic` runs no `sidecar.bundle.compile`,
      and no `sidecar.describe` if descriptions are cached. `serve.ready`
      falls from about 4.2 s to 1.5 s or less on the baseline machine.
    - A change to any consumed input misses and rebuilds. A cache entry from
      another format version is rejected and rebuilt.
    - `mokly build --strict` output with a cache hit is byte-identical to
      the output of a cold build.
    - A damaged or unreadable entry: warn, rebuild, and continue.
    - Tests, each at the lowest level that fails without the change: a hit,
      a miss for each input kind, a version mismatch, a damaged entry,
      eviction under the byte bound, and two writers.
  - The pool can already install a recipe in a new sidecar with the
    `restoreGeneration` request. One stored head recipe of `examples/basic`
    is 3.3 MB of JSON with 2,753 consumed input files.
  - The recipe does not record `jsconfig.json` candidates, tsconfig
    `extends` targets, or peer manifests other than React. In-process reuse
    already misses changes to them. A restart clears the gap today.
  - The plan's design calls, of 2026-10-30:
    - The `reuse` check digests the consumed files in parallel: about 0.2 s
      instead of 0.4 s on the slow machine, also for in-process reuse.
    - The pool stores an entry before it returns the result, so tests stay
      deterministic and no write stays in flight at exit. A store cost above
      100 ms on a miss reopens this call.
    - Each entry carries a SHA-256 digest of its payload, and a hit checks
      it. One 3 MB file hashes in about 10 ms.
    - The key is the SHA-256 digest of the bundle parameters without
      `evaluation`. The parameters include the source root, so each side and
      each extraction gets its own key.
    - A failed bundle stores no entry.
    - The work adds the bundle cache to the OS cache sentence of
      `docs/protocol/mokly-runtime.md:62`.
    - `crates/mokly-catalogue/src/preparation.rs` does not change. The core
      sends `bundle` and `describe` from `crates/mokly-render/src/bundle.rs`
      and `bundle_attempt.rs`.
  - `docs/protocol/mokly-timings.md:42` lists a `catalogue.describe` span,
    and `crates/mokly-cli/src/serve_trace_stages.rs:13` allows it. No code
    emits it. Decision 8 settles the row.
  - On 2026-10-27 the user set this finding aside. On 2026-10-30 the user
    chose to start it in parallel with
    [keep-base-side-in-memory.md](./keep-base-side-in-memory.md).
- **Problem:** Every restart compiles the same unchanged sources again, and
  so does the base side of each first classification.
- **Impact if no action:** Startup stays about 3 s over the target on the
  baseline machine.
- **Root question:** How does a new Mokly process reuse an earlier compile
  of unchanged sources, with no risk of stale code?
- **Options:** Nine decisions are open. Answer each by number and letter.
  1. **Where the stored bundle is checked** (High). **A.** The pool installs
     the stored recipe with `restoreGeneration`, and the sidecar's `reuse`
     check accepts it or compiles. Both sides use it. **B.** The render
     runtime checks it with its Rust input stamp. The base side then needs a
     change in `crates/mokly-cli/src/changes_base.rs`. **C.** The sidecar reads and writes the store. This
     breaks the rule that the sidecar writes no files. **D.** As B, but the
     pool holds the store. About 0.1 s faster per hit than A. All Large.
  2. **The 1.5 s startup target is out of reach** (High). This item alone
     gives about 2.6 s on the baseline machine. **A.** Change the acceptance
     to no compile on a warm restart and 2.0 s faster startup, and move the
     target to
     [stylesheet-cache-across-restarts.md](./stylesheet-cache-across-restarts.md).
     Small. **B.** Also keep the class-map stylesheet records, about 1.7 s.
     **C.** Also keep descriptions, about 2.4 s. **D.** Also keep the whole
     stylesheet cache, about 1.2 s. B to D: Large.
  3. **What the cache keeps** (Medium). A description also depends on peer
     packages, the environment, the time, and files outside the module
     graph. **A.** The compiled bundle only. Small. **B.** Also the
     description, with lazy bindings. **C.** Both, checked in the background
     against the first real evaluation. B and C: Large.
  4. **Key and recorded inputs** (Medium). **A.** Key on the settings, and
     require an equal toolchain identity in `reuse`. **B.** Put the identity
     in the key, reported by `hello`. **C.** Add only the Mokly version to
     the key, so stale code can pass. Small. **D.** A, and record peer
     manifests, `jsconfig.json` candidates, and `extends` targets. **E.** D
     without `extends`: `examples/basic` would never hit. A, B, D, E: Large.
  5. **Base side entries** (Medium). Compiled code holds absolute paths.
     **A.** Each side keeps its own entries under its own source root.
     Small. **B.** Store relative paths and rewrite them at restore. Large.
     **C.** Head only. It loses about 3.2 s per first classification. Small.
  6. **Storage format and bound** (Medium). **A.** A third OS cache kind,
     `bundles`, with a 512 MiB bound. Each entry is one file whose first line
     gives format version 1 and a payload SHA-256. A replace operation runs
     under the entry lock. **B.** A separate one-file-per-key store. Medium.
     **C.** An embedded database. **D.** A, and the first line also names
     the Mokly version, so another release misses without a parse. **E.**
     Entries that never change, with a pointer file per key. A, C, D, E:
     Large.
  7. **Terminal output** (Low). **A.** No output. The timing record names
     the reason. It drops the task's warning. Small. **B.** A, plus one
     warning line for a damaged entry or an unusable directory. **C.** B,
     plus the shared cache directory line. **D.** A, plus the directory line.
     It drops the task's warning. B to D: Large.
  8. **Timing record** (Low). **A.** A new core span `catalogue.bundle` with
     `cache` set to `hit`, `memory`, `no-record`, `stamp-mismatch`,
     `version-mismatch`, `damaged`, or `unavailable`, and remove the dead
     `catalogue.describe` row. **B.** Emit `catalogue.describe` with that
     field. **C.** Put the field on `sidecar.bundle`. **D.** The pool emits
     the span. All Large.
  9. **Tests** (Low). Tests already cover the six input kinds of the
     `reuse` check. `crates/mokly-render/tests/integration/watch_tests.rs`
     covers module bytes. `watch_metadata_tests.rs` in the same directory
     covers ancestor manifests, tsconfig files, the React manifest, preview
     candidates, and directory membership. The stored path goes through the
     same check.
     - **A.** One test for each new rule. The tests cover a hit in a fresh
       process, a changed-source miss, and a toolchain miss. They also cover
       a version mismatch, a damaged entry, two writers of one key, and the
       `cache` field of a real span. Eviction keeps its existing tests.
     - **B.** The task's test list as written. It differs from A in two
       ways: a stored-path miss for each input kind, and an eviction test
       for the new kind.
     - **C.** A, plus one case in
       `crates/mokly-compare/src/_tests_/cache_tests.rs`: a replace past the
       bound evicts the least recently used other entry. With 4D, add one
       case for each new input kind to the existing reuse tests. Under A, a
       replace that skips eviction passes every test.
     - All three: Small.
- **Left out:**
  - A shared sidecar daemon: a sidecar must never outlive its binary.
  - A store of only the native resolution plan: the second compile still
    runs.
  - Listening before validation ends: the user rejected usable navigation
    before every entry is ready, in `docs/protocol/mokly-timings.md`.
- **Wider fix:** 4D. It also closes the same input gaps of in-process reuse.
- **Previous examples:** The pool's in-memory seed in
  `crates/mokly-sidecar/src/pool_preparation.rs`.
- **Related:**
  - [stylesheet-cache-across-restarts.md](./stylesheet-cache-across-restarts.md):
    the rest of the startup target, under decision 2A.
  - [jsconfig-resolution-input.md](./jsconfig-resolution-input.md): 4D
    records the same file for reuse. That item also covers the watch rule.
  - The
    [compiled recipe cache item at its last commit](https://github.com/mokly-ai/mokly/blob/c7e7d9b88efc84152eb33539ed8ed7ca2ad2bb93/plans/follow-ups/compiled-recipe-cache.md)
    asked for reuse of released compiled recipes in memory. It closed on
    2026-11-01, when the sidecar pool started to keep the last released
    recipe of each set of bundle settings, its option D, under the
    [compiled recipes contract](../../docs/protocol/mokly-sidecar-modules.md#compiled-recipes-and-release).
    D restores a recipe through the same `restoreGeneration` request and
    `reuse` check as 1A. Decide this item with D in mind.
  - The
    [large React startup item at its last commit](https://github.com/mokly-ai/mokly/blob/75bacb9d016205c804633b79ff0e8496c6c07929/plans/follow-ups/large-react-startup.md)
    closed on 2026-11-01, when large React startup measured about 3.7 s,
    cold and warm.
  - [keep-base-side-in-memory.md](./keep-base-side-in-memory.md): both
    shorten the base side. Measure again after either merges.
- **Recommendation:** 1A, 2A, 3A, 4D, 5A, 6D, 7C, 8A, 9C.
  - 1A: one check then decides for live and stored recipes, with no new
    pool method. 1D is about 0.1 s faster for each hit.
  - 2A: the bundle is the part that this item can remove. Only 2D reaches
    1.5 s, and it needs its own design.
  - 3A: a stored description saves at most 0.26 s and risks wrong output.
  - 4D: no stale code passes the check, also after a toolchain change.
  - 5A: it needs no extra code and keeps one compile identity per side.
  - 6D: one set of cache rules, and a new release never parses old entries.
  - 7C: the user sees damage and finds the cache directory to delete.
  - 8A: the span measures the whole wait that the cache shortens.
  - 9C: under A, a replace that skips eviction passes every test.
- **Action:** ask the user, because the recommended options change the
  task's requirements and rules in force. 2A changes the acceptance, 4D
  changes the reuse rule, and 6D adds a 512 MiB budget. 7C changes the
  terminal output, and 9C changes the task's test list.

The full plan, with its baseline, design, and six milestones, is in the [unmerged plan](https://github.com/mokly-ai/mokly/blob/0677f60995459ae066142770207e14b8ebe7e250/plans/bundle-disk-cache.md?plain=1).
