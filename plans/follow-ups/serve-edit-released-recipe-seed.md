# Warm edits restore a recipe that cannot pass

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-21, from the split of the Serve edit bundle on branch
  `calummoore/mokly-edit-bundle-path-kv2o`.
- **Location:**
  - `crates/mokly-sidecar/src/pool_preparation.rs:57`: `seed_compilation`. It
    sends the released recipe at line 124 and returns `complete` from line 113.
  - `crates/mokly-sidecar/src/pool_recipes.rs:99`: `seed`, which touches the
    recipe for the least recently used order and returns its
    `restoreGeneration` call.
  - `crates/mokly-sidecar/src/pool_bundle_cache.rs:46`: `seed_bundle`, which
    loads the bundle cache entry when `seed_compilation` returns false.
  - `crates/mokly-sidecar/src/pool_cleanup.rs:23`: `stale_generation`, which
    makes the cleanup dispose each seeded id before the next request of the
    slot.
  - `packages/mokly/src/sidecar/compiled.ts:115`: `reuse`, whose input checks
    start at line 152 and stop at the first mismatch.
  - `docs/protocol/mokly-sidecar-recipes.md:177`: the section "Released
    Recipes".
- **Reason:** The pool and `compiled.ts` belong to another workspace while it
  changes the restored reuse path, and the change needs a protocol decision.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Released recipe:** the compiled recipe of a released generation. The
    pool keeps the last one of each set of bundle settings, within 64 MiB.
  - **Seed:** the `restoreGeneration` request with which the pool installs a
    released recipe in the chosen sidecar before a `bundle` request.
  - **Forward edit:** an edit that gives a file new content. A revert gives a
    file the content of an earlier compile.
  - **Warm edit:** a one-line edit in a running Serve session after the first
    ready Changes.
  - **Live candidate:** the newest live compilation of equal settings, which
    the pool can also restore before a `bundle` request.
- **Background:**
  - The section "Released Recipes" of `docs/protocol/mokly-sidecar-recipes.md`
    lets a later `bundle` call reuse the released recipe. Its decision cites a
    session with two edits and two reverts, in which the recipe served all 6
    of 10 bundles that repeated an earlier compile.
  - Before each `bundle` request, `seed_compilation` sends the released recipe
    of the same settings with `restoreGeneration`. It also restores the live
    candidate when the slot lacks it. The cleanup disposes each seeded id
    before the next request of the slot, so every request sends the recipe
    again.
  - When `seed_compilation` seeds nothing, `seed_bundle` loads the bundle
    cache entry from disk, and the `cache` value of `catalogue.bundle`
    changes.
  - In a Serve head, each warm edit releases the previous head generation.
    After a forward edit, the sidecar's reuse check of the seeded recipe
    always fails, because the edited source differs. The check stops at the
    first mismatch, but it reads the inputs in the order of the recipe, so
    the edited file can come late.
  - The recipe records the digest of each consumed source in
    `compiled.inputs`, keyed by the real absolute path. The pool also holds
    the `compiled` value of each live generation.
  - The core's watch `Batch` holds the changed paths of one action, as
    lexical paths. The batch does not reach the build today.
  - Each final release encodes the whole recipe to count its bytes, while it
    holds the pool lock.
  - Measured on 2026-11-21 on mokly-cloud at `194fdb78`, with a release core
    and dist of `main` at `377111494`, 4 vCPU, and 4 sidecars, in probed
    sessions:
    - Each warm edit sent a seed of 5.96 MB. The first seed of a session sent
      9.39 MB once.
    - From the start of `catalogue.bundle` to the sidecar's receipt of the
      `bundle` request: 96 to 234 ms with a seed, and 46 to 76 ms without one.
    - The sidecar's `reuse`: 15 to 64 ms with the seed, and 13 ms without it.
    - The compile and the rest of the edit did not depend on the seed.
  - Another workspace adds a section "Restored Reuse" to
    `docs/protocol/mokly-sidecar-recipes.md`. It gives a short answer when a
    reuse check accepts a restored generation. That workspace also moves the
    rules of released recipes to a new page,
    `docs/protocol/mokly-sidecar-release.md`. The short answer speeds up
    reverts. It does not change a rejected seed.
- **Problem:** Each warm forward edit transfers and installs a released recipe
  that its reuse check then rejects, before the compile starts.
- **Impact if no action:** Each warm forward edit of mokly-cloud keeps about
  50 to 75 ms before its compile, and the transfer grows with the recipe.
- **Root question:** How can a warm edit stop spending critical-path time on a
  released recipe that cannot serve it, while a revert keeps its reuse, with
  the same results and a memory peak within 2% of `main`?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Stop seeding released recipes for `serveEdit` requests. Each revert
    then compiles, about 600 ms on mokly-cloud. The pool must keep `complete`
    true and the least recently used touch, or it loads the bundle cache
    entry instead. Effort: Small.
  - **H.** Check the likely changed inputs first. In `reuse`, read first the
    inputs whose digests differ between the generations of equal settings
    that the process holds, or the input that failed the last check. The
    checks stop at the first mismatch, so the order changes no result. A
    failed check of 13 to 64 ms becomes a few reads. The transfer stays. No
    protocol change. Effort: Small.
  - **C.** Skip the seed when the watch action rules the recipe out. The core
    takes each changed path of the watch action, maps it to its real path,
    and reads its digest when the released recipe records it as a consumed
    source. When one digest differs, the pool sends no seed, but it keeps
    `complete` true and the least recently used touch. A revert gives the
    recorded digests again, so its seed and its reuse stay. It brings the
    batch to the build, and it changes the pool, `crates/mokly-render`, and
    `crates/mokly-cli`. Effort: Medium.
  - **D.** Check every recorded input of the released recipe in the binary
    before the seed. It needs no watch data. It repeats the sidecar's check
    whenever the seed goes ahead. The section "Bundle Cache Seeding" rejected
    such a check for stored compilations, because it needs new pool methods.
    Effort: Medium.
  - **E.** Keep the previous evaluated head generation in the bundling process
    until the next compile ends. The transfer goes, but the reuse check stays,
    and each process holds one more evaluated generation. The record of the
    head generation preload measured about 8% more peak memory with two
    evaluated head generations. Effort: Medium.
  - **F.** Prove the failure in the pool with the live candidate. In
    `seed_compilation`, outside the lock, compare `compiled.inputs` of the
    released recipe with that of the live candidate. For each path whose
    recorded digests differ, read the current digest, and stop at the first
    one that differs from the released recipe. Then send no seed, but keep
    `complete` true and the least recently used touch. In the measured edits,
    one file read rules the seed out. A one-step revert gives back the
    released digest, so its seed stays. It needs no watch data and no path
    mapping. A forward edit right after a CSS Modules rebuild keeps today's
    seed. It changes the pool only, with one protocol sentence in the rules
    of released recipes and one in the `stamp-mismatch` row of
    `docs/protocol/mokly-timings.md`. Effort: Medium.
  - **I.** Keep the encoded seed frame. `insert` in `pool_recipes.rs`
    already encodes the whole `restoreGeneration` request to count its bytes,
    and it drops them. Keep the bytes and write them as they are for each
    seed. The encode of each seed goes, but the transfer and the check stay.
    It costs about one recipe of memory in the core, and a raw frame write in
    the worker. Effort: Medium.
  - **G.** Keep the released recipe in the sidecars. At a final release, each
    process turns the old generation into an unevaluated released recipe in
    place, and the pool sends no seed to a process that holds it. The
    transfer goes for forward edits and for reverts, but the failed check
    stays, so H joins it. It holds one unevaluated recipe in each of four
    processes, close to the 2% budget. It needs a protocol decision, the
    pool, and `session.ts`. Effort: Large.
- **Left out:** A seed that sends the evidence first and the code only after a
  pass. It keeps a transfer and a check on each forward edit, which F skips,
  and it adds a round trip and a second check to each revert.
- **Wider fix:** F, in a general form: one admission rule for every recipe
  that the pool sends before a `bundle` request. That covers the released
  seed, the live candidate, the fallback, and the bundle cache seed. C must
  know the watch batch, so C is a direct fix only.
- **Previous examples:** The released recipe store of 2026-11-01 added the
  seed. PR #449 and PR #463 shortened the reuse reads and the response work.
- **Related:**
  - [serve-edit-bundle-split.md](./serve-edit-bundle-split.md) holds the split
    of the edit bundle. Its cuts B, C, D, and G, with F and H of this item,
    project about 105 to 150 ms for each warm edit.
  - [release-recipe-encode-under-pool-lock.md](./release-recipe-encode-under-pool-lock.md)
    holds the encode of each released recipe under the pool lock, the same
    code as option I.
  - [bundle-cache-request-cost.md](./bundle-cache-request-cost.md) holds the
    cost of the bundle cache seed, a different seed with its own rules.
- **Recommendation:** F. It gives the saving on the measured edits with a
  change in the pool only, and it needs no watch data and no path mapping.
  The first recommendation was C. H can join F as a Small change without a
  protocol decision.
- **Action:** ask the user, because the change is in the pool and in
  `compiled.ts`, which another workspace changes now, and it changes the
  rules of released recipes, a protocol section.
