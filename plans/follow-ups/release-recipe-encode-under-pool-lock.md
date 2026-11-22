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
- **Reason:** On 2026-11-21 the user kept it out of the change that found it,
  and nobody has measured the wait.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Released recipe:** the compiled recipe of a released generation. The
    pool keeps the last one of each set of bundle settings, within 64 MiB.
  - **Pool lock:** the mutex of the sidecar pool state in
    `crates/mokly-sidecar`. Each request takes it to choose a process.
- **Background:**
  - The release rules in `docs/protocol/mokly-sidecar-release.md` count each
    released recipe at the size of its serialized `restoreGeneration`
    envelope, within a total of 64 MiB.
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
  - **D.** Keep the encoded bytes and reuse them for each seed. A seed is the
    `restoreGeneration` request with which the pool installs a released
    recipe in a sidecar before a `bundle` request. Today `seed` in
    `pool_recipes.rs:99` builds that request again, and the worker encodes
    it again. D keeps the bytes of `insert` and writes them as they are for
    each seed. The encode of each seed goes, but the transfer and the
    sidecar's reuse check stay. It costs about one recipe of memory in the
    core, and a raw frame write in the worker. The first encode stays under
    the lock unless B joins it. Since 2026-11-22, the pool sends no released
    recipe that the current files already rule out, so a warm forward edit
    sends no seed, and D saves an encode mostly on a revert. Effort: Medium.
- **Left out:** An estimate of the size without a serialization, because the
  64 MiB bound must count the exact envelope bytes.
- **Wider fix:** None. This is one place with heavy work under a lock. No other
  case is known.
- **Previous examples:** None found.
- **Recommendation:** B. It takes the encode off the lock with the same count
  and the same rules.
- **Action:** fix after merge, apply B, because the user kept it out of the
  change of 2026-11-21. First measure the wait, so that a gain is shown.
