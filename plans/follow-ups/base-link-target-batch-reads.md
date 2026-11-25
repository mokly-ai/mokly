# Base dotenv setup starts Git per link

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 141.
- **Location:** `crates/mokly-compare/src/base_vite_env.rs:35`,
  `crates/mokly-git/src/repository_access.rs:94`, and the batch decision at
  `docs/protocol/mokly-git.md:142`.
- **Reason:** The fix adds a Git batch operation, and the current path costs
  much only in trees with many links.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Base:** The selected commit that Mokly renders as the historical side
    of Changes. Mokly extracts its files into a cache.
  - **Committed link:** A symbolic link that a commit holds as a Git tree
    entry. Its blob holds the target path.
  - **Batch read:** One `git cat-file --batch` process that reads many
    objects.
- **Background:**
  - The base Vite setup resolves committed links at any component of an env
    candidate path, also at `envDir`, under
    `docs/protocol/mokly-vite-adapter-inputs.md:89` to line 92. The working
    agent of the branch that found this item chose this on 2026-11-25. The
    binary sends the link targets to the base sidecar, because the sidecar
    starts no Git process.
  - `setup_sources`, at `crates/mokly-compare/src/base_vite_env.rs:30`, reads
    every committed link of the pinned tree before Vite selects its env
    directory. It starts one Git process for each distinct link blob,
    through `Repository::read_link` at
    `crates/mokly-git/src/repository_access.rs:94`. The map reaches the
    sidecar at `crates/mokly-cli/src/changes_base.rs:166`.
  - `docs/protocol/mokly-git.md:142` records that process starts dominated
    base preparation. So the extraction converts each batch of files with one
    `git cat-file --batch --filters` process, at
    `crates/mokly-git/src/checkout_batch.rs:164`.
  - `plans/follow-ups/git-opaque-asset-batching.md` measured about 6 to 7 ms
    for each Git process. At that cost, 1,000 distinct links add about 6 to
    7 s to each base preparation, also when the extraction and the
    installation come from the cache. Most trees hold few links. This
    repository holds one, `CLAUDE.md` to `AGENTS.md`.
  - In a partial clone, the tree listing fetches every missing link blob in
    one request, at `crates/mokly-git/src/fetch.rs:49`. A link blob is a
    short path. So the cost is the process starts, not the bytes.
- **Problem:** The base setup starts one Git process for each distinct
  committed link, before it knows which links it needs.
- **Impact if no action:** A tree with many distinct links adds seconds to
  each base preparation, also when the env directory has no links.
- **Root question:** How does the base side get the committed link targets
  that its readers need, with a number of Git processes that does not grow
  with the number of links?
- **Options:**
  - **A.** Cache the target map by the pinned tree. Repeat requests then
    start no process, but the first preparation still starts one for each
    blob. Effort: Small.
  - **B.** Read the raw link blobs in bounded batches through the Git
    boundary. Keep cancellation and the byte limit of each blob, and keep
    every committed link in the map. Effort: Medium.
  - **C.** Resolve links as Vite selects candidates, and read only the Git
    entries that the setup needs. A cheaper form: the binary sends the path
    of every committed link, which the tree listing gives without a read.
    The sidecar records each link that its lookup reaches without a target.
    The binary then reads those links with the reader of B and runs the setup
    again. Cost: a new interaction between the sidecar and the base source
    reader. It also removes the full map that the config link fixes of
    `plans/follow-ups/base-extraction-committed-links.md` plan to use.
    Effort: Large.
  - **D.** Read every committed link target once for each base extraction, in
    the batches of the extraction, and keep the targets with the extraction
    lease. `setup_sources` then takes the map from the lease, and later
    preparations and runs for the same commit start no Git process for
    links. If the extraction keeps committed links, it must read each target
    anyway, so it can record the targets at no extra Git cost. Cost: a new
    source entry identity or receipt schema, under
    `docs/protocol/mokly-base-cache.md:23`, and a change of the extraction
    rule at `docs/protocol/mokly-git.md:151`. So D waits for the answer to
    the extraction item. Effort: Large, or Medium on top of the extraction
    change.
  - **E.** Make bounded batches the only way that the Git boundary reads many
    objects of a base. Replace `Repository::read_link` with a method that
    takes a slice of entries. It runs one `cat-file --batch` process for each
    bounded batch, keeps cancellation and the bound of each blob, and returns
    one result for each entry. Extend the decision at
    `docs/protocol/mokly-git.md:142` from converted files to every base read
    of many objects. Use the same boundary for the opaque-asset digests of
    `plans/follow-ups/git-opaque-asset-batching.md`. Cost: the protocol
    sentence adds a requirement, so the user decides, and the work merges
    with that item. Effort: Large.
- **Left out:**
  - Read only the links whose names start with `.env`. It fails the goal,
    because the lookup resolves links at every component of the candidate
    path, also a linked `envDir`.
  - Call `read_link` in parallel. B is better on every point. It starts one
    process, not one for each link, and it needs no thread pool.
  - Cap the number of links that the setup reads. It fails the goal. An
    unread link on a candidate path gives the base the head's value, which
    gives a false or a hidden change. A failure at the cap is a new
    rejection.
  - Take the targets from unchanged working-tree links. B is better on every
    point. B is exact with one process, and this approach needs an index
    comparison, a fallback for each changed link, and a rule for checkouts
    with `core.symlinks=false`.
- **Wider fix:** E. B must know the detail, link blobs, and the raw link
  reader has one caller, so B does not prevent the class. E puts every base
  read of many objects through bounded batches. Then a new reader, such as a
  config link lookup, cannot start one process for each object. E needs the
  user, because it adds a requirement to `docs/protocol/mokly-git.md`.
- **Previous examples:** `docs/protocol/mokly-git.md:142` records the same
  process cost for checkout conversion.
  `plans/follow-ups/base-batch-fallback-processes.md` records it for the
  fallback after a failed batch. `plans/follow-ups/git-opaque-asset-batching.md`
  records it for opaque assets.
- **Related:**
  - `plans/follow-ups/base-extraction-committed-links.md`: the same code and
    a shared batch reader. Its direct options for config links reuse the
    full map of `setup_sources`, so each fix here must keep every committed
    link available. A, B, D, and E do. C does not. If the user keeps
    committed links in the extraction before this work starts, apply D, not
    B.
  - `plans/follow-ups/vite-outside-env-directory.md`: for C only. C changes
    the same base selection in `packages/mokly/src/sidecar/vite-base-env.ts`,
    so do C only after that answer.
  - `plans/follow-ups/vite-base-env-link-target-names.md`: the same function.
    That fix changes the paths that `setup_sources` records from the link
    targets.
  - `plans/follow-ups/git-opaque-asset-batching.md`: E merges with that item.
- **Recommendation:** B. It removes the main cost with the smallest change,
  keeps every committed link available, and gives an extraction that keeps
  links its batch reader. Apply D instead if the user keeps committed links
  in the extraction before this work starts.
- **Action:** fix after merge, apply B, because it adds a Git batch operation,
  and the current path costs much only in trees with many links.
