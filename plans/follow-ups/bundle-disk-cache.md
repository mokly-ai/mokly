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
  - On 2026-10-30, `main` at `f93afcea` on a slow machine: warm
    `serve.ready` 6.6 s, head bundle 2.8 s, CSS Modules class maps 1.5 s,
    `sidecar.describe` 0.26 s, base bundle 3.2 s. The baseline machine
    measured `serve.ready` at 4.2 s. The task asked for 1.5 s or less there
    on a warm restart. The user's startup target is about 1 s.
  - The pool can already install a recipe in a new sidecar with the
    `restoreGeneration` request. One stored head recipe of `examples/basic`
    is 3.3 MB of JSON with 2,753 consumed input files.
  - The recipe does not record `jsconfig.json` candidates, tsconfig
    `extends` targets, or peer manifests other than React. In-process reuse
    already misses changes to them. A restart clears the gap today.
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
     the reason. Small. **B.** A, plus one warning line for a damaged entry or
     an unusable directory. **C.** B, plus the shared cache directory line.
     **D.** A, plus the directory line. B to D: Large.
  8. **Timing record** (Low). **A.** A new core span `catalogue.bundle` with
     `cache` set to `hit`, `memory`, `no-record`, `stamp-mismatch`,
     `version-mismatch`, `damaged`, or `unavailable`, and remove the dead
     `catalogue.describe` row. **B.** Emit `catalogue.describe` with that
     field. **C.** Put the field on `sidecar.bundle`. **D.** The pool emits
     the span. All Large.
  9. **Tests** (Low). **A.** One test for each new rule: a hit in a fresh
     process, a changed-source miss, a toolchain miss, a version mismatch, a
     damaged entry, two writers, and the `cache` field. **B.** The task's
     list as written. **C.** A, plus a replace-past-the-bound eviction case,
     and one case for each new input kind of 4D. All Small.
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
  - [compiled-recipe-cache.md](./compiled-recipe-cache.md) and
    [large-react-startup.md](./large-react-startup.md): other compile reuse
    and startup work. Decide them together.
  - [keep-base-side-in-memory.md](./keep-base-side-in-memory.md): both
    shorten the base side. Measure again after either merges.
- **Recommendation:** 1A, 2A, 3A, 4D, 5A, 6D, 7C, 8A, 9C. One input check
  then decides for live and stored recipes, and no stale code passes it.
- **Action:** ask the user, because the recommended option 2A changes the
  acceptance of the task, and 4D changes the reuse rule.

The full plan, with its baseline, design, and six milestones, is in the [unmerged plan](https://github.com/mokly-ai/mokly/blob/0677f60995459ae066142770207e14b8ebe7e250/plans/bundle-disk-cache.md?plain=1).
