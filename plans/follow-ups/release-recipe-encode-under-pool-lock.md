# Each release encodes its recipe under the pool lock

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-21, from the options check of the Serve edit bundle split
  on branch `calummoore/mokly-edit-bundle-path-kv2o`.
- **Location:**
  - `crates/mokly-sidecar/src/pool_releases.rs:70`: `record_release`, which
    takes the pool lock and calls `state.recipes.insert` at line 93.
  - `crates/mokly-sidecar/src/pool_recipes.rs:50`: `insert`, which encodes
    the whole `restoreGeneration` request at line 73 only to count its bytes.
- **Reason:** The pool belongs to another workspace while it changes the
  restored reuse path, and nobody has measured the wait.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Released recipe:** the compiled recipe of a released generation. The
    pool keeps the last one of each set of bundle settings, within 64 MiB.
  - **Pool lock:** the mutex of the sidecar pool state in
    `crates/mokly-sidecar`. Each request takes it to choose a process.
- **Background:**
  - The section "Released Recipes" of `docs/protocol/mokly-sidecar-recipes.md`
    counts each released recipe at the size of its serialized
    `restoreGeneration` envelope, within a total of 64 MiB.
  - When the last lease of a generation ends, `record_release` takes the pool
    lock, moves the bundle settings, the compiled recipe, and the module graph
    out of the state, and calls `insert`.
  - `insert` builds the `restoreGeneration` request and encodes all of it with
    `codec::encode` to count its bytes. It then drops the encoded bytes. The
    lock stays held for the whole encode.
  - On mokly-cloud, one head recipe encodes to about 6 MB. In Serve, the
    release of the old head generation comes at the start of the background
    pass that follows a publication, when the renders of that pass take the
    lock.
  - Nobody has measured how long the encode holds the lock.
- **Problem:** Each final release encodes a recipe of several MB while it holds
  the pool lock, so every pool request that comes at that moment waits.
- **Impact if no action:** The renders that start after a publication can wait
  for one encode. The wait grows with the recipe.
- **Root question:** How can the pool count the bytes of a released recipe
  without holding its lock for an encode?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Encode outside the lock. Take the recipe out of the state under the
    lock, release the lock, encode and count, then take the lock again and
    insert. The insert must check the stop flag again and keep the same
    order rules. Effort: Small.
  - **C.** Count the bytes with a serializer that writes into a counter, not
    into a buffer. This removes the 6 MB allocation, but the serialize time
    stays under the lock unless B joins it. Effort: Small.
  - **D.** Keep the encoded bytes and reuse them for each seed. This is option
    I of the seed item. It removes later encodes, but the first encode stays
    under the lock unless B joins it. Effort: Medium.
- **Left out:** An estimate of the size without a serialization, because the
  64 MiB bound must count the exact envelope bytes.
- **Wider fix:** None. This is one place with heavy work under a lock. No other
  case is known.
- **Previous examples:** None found.
- **Related:**
  - [serve-edit-released-recipe-seed.md](./serve-edit-released-recipe-seed.md)
    holds the seed of the same recipes. Its option I keeps the encoded bytes,
    which D uses.
- **Recommendation:** B. It takes the encode off the lock with the same count
  and the same rules.
- **Action:** fix after merge, apply B, because the pool belongs to another
  workspace while it changes the restored reuse path. First measure the wait,
  so that a gain is shown.
