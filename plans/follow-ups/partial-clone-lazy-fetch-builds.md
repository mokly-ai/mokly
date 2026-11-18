# Blobless base reads can fail on backported Git

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-16, from the branch `calummoore/plain-git-spawns`, review round 1, the check of finding 2. On 2026-11-17 it took in the facts of a second item, `git-missing-blob-root-check.md`, from the branch `calummoore/lisbon-h906`, where the repository gate stopped on Git 2.43.0.
- **Location:** `crates/mokly-git/src/repository_access.rs:41` to line 44,
  `crates/mokly-git/src/lookup.rs:40`, `crates/mokly-git/src/fetch.rs:45` to
  line 69, `crates/mokly-git/src/checkout_index.rs:44` to line 58,
  `crates/mokly-cli/tests/changes_failures_tests.rs:154` to line 184, and
  `docs/protocol/mokly-git.md:41` to line 44.
- **Reason:** `origin/main` behaves the same, so the branch that found it does not change it.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Partial clone:** a repository with a promisor remote that omits some
    objects until a command needs them. A promisor remote has the setting
    `remote.{name}.promisor` set to true, or `extensions.partialClone` names
    it. A blobless clone omits blobs, for example after
    `git clone --filter=blob:none`.
  - **Lazy fetch:** Git's automatic fetch of a missing object from the
    promisor remote while an ordinary command reads it.
  - **Lazy-fetch control:** the environment variable `GIT_NO_LAZY_FETCH=1`,
    which `crates/mokly-git/src/system_command.rs` sets for ordinary Git
    commands.
  - **Backported build:** a Git build that got the control from the
    2024-05-14 security releases (2.39.4, 2.40.2, 2.41.1, 2.42.2, 2.43.4,
    2.44.1, their later point releases) or from a distribution patch, such as
    Ubuntu `2.43.0-1ubuntu7.3`, but not the later Git 2.45 code.
  - **Start point:** an object id that a Git command receives directly, on its
    command line or its standard input, and not through the walk of a tree.
- **Background:**
  - `docs/protocol/mokly-git.md`, lines 41 to 44, says: "Base reads disable
    Git's lazy fetch while they check object presence. A promisor remote
    fetches every missing base object in one bounded request before the
    converted read starts." It also says: "A failed fetch names a recovery
    `git fetch` command. Missing objects without a promisor remote retain a
    typed fetch error."
  - `docs/protocol/mokly-base-preparation.md`, lines 51 to 52, keeps genuine
    Git command and object failures as fatal `git-failed` errors. Lines 57 to
    58 say: "A failed fetch of missing objects names the recovery command."
  - Base reads run `ls-tree -l` first
    (`crates/mokly-git/src/repository_access.rs:42` and
    `crates/mokly-git/src/lookup.rs:40`). It reads each blob's size. The
    missing-object check and the one bounded fetch run after it.
  - `GitRepositories::open`, in `crates/mokly-git/src/repository.rs`, reads
    the promisor remotes once, after its root check and before any base read.
    One plain `config` command reads `remote.{name}.promisor` and
    `extensions.partialClone`. With a promisor remote, `tree_request` in
    `crates/mokly-git/src/repository_command.rs` gives both `ls-tree` calls
    the mode `ProcessMode::FullTree`, the full tree. That mode starts Git in
    a new session and, on Linux, makes Git adopt orphan helpers. Without a
    promisor remote, both calls keep the faster `ProcessMode::PlainGroup`, a
    plain process group in the core's session.
  - The source key and the checkout identity hash the checkout settings of the
    whole base commit. They list it through the same `Repository::list`
    method, at `crates/mokly-git/src/source_key.rs:33`. A base computes the
    source key when it looks up or builds its source extraction. A Serve base
    preparation samples the checkout identity before its first base read. The
    check before Serve reuses a kept base, `ServeBase::find_kept` in
    `crates/mokly-cli/src/serve_base.rs`, samples it again. So these reads
    also run `ls-tree -l` before the missing-object check, for every regular
    file of the commit. When the sample fails for a reason other than
    cancellation, the preparation records no freshness evidence and continues,
    so Serve keeps no base.
  - After the listing, `ensure_checkout_objects`
    (`crates/mokly-git/src/checkout_index.rs:44` to line 58) passes the
    checkout entries and their `.gitattributes` files to `ensure_objects`
    (`crates/mokly-git/src/fetch.rs:27` to line 119). Its check marks each
    missing blob with an output line `?{hash}`.
    - With a promisor remote, one `git fetch --stdin` fetches all of them, at
      `fetch.rs:71` to line 118.
    - Without a promisor remote, `fetch.rs:69` returns `MissingObject`. Its
      text, at `crates/mokly-git/src/error.rs:132`, is "[mokly-git/fetch] base
      object {object} is missing; run `git fetch origin {object}`".
  - `crates/mokly-git/src/system_command.rs:32` sets `GIT_NO_LAZY_FETCH=1` for
    each ordinary Git command.
  - A check on 2026-11-16 read Git 2.43.4 `promisor-remote.c` and
    `packfile.c`. On a backported build, `GIT_NO_LAZY_FETCH=1` still reaches
    `promisor_remote_get_direct`, and `ls-tree -l` then dies with
    `could not fetch {oid} from promisor remote` at the first missing blob of
    a blobless clone. Nobody reproduced it.
  - Probes of 2026-11-16 ran single Git commands in temporary repositories,
    with `GIT_NO_LAZY_FETCH=1`. They did not run the whole base read. Their
    Git 2.43.0 is the Ubuntu package `1:2.43.0-1ubuntu7.3`, a backported
    build:

    | Command                                                                             | Git 2.43.0, corrupt repository       | Git 2.43.0, partial clone                                      | Git 2.50.1, partial clone           |
    | ----------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------- | ----------------------------------- |
    | `rev-list --objects --no-object-names --missing=print --stdin`, blob as start point | exit 128, `fatal: bad object {hash}` | exit 128, `fatal: bad object {hash}`                           | `?{hash}`, exit 0                   |
    | `cat-file --batch-check`, blob id on standard input                                 | `{hash} missing`, exit 0             | exit 128, `fatal: could not fetch {hash} from promisor remote` | `{hash} missing`, exit 0            |
    | The same `rev-list`, with the parent tree of the blob as start point                | the tree id, then `?{hash}`, exit 0  | the tree id, then `?{hash}`, exit 0                            | the tree id, then `?{hash}`, exit 0 |
    - The corrupt repository lost one loose blob of an older commit. The
      partial clone is a `file://` clone with `--filter=blob:none` from a
      repository with `uploadpack.allowFilter`.
    - In the partial clone, `cat-file --batch-check` under Git 2.43.0 first
      printed "warning: lazy fetching disabled; some objects may not be
      available". So the control reaches the promisor fetch path there, as the
      check of Git 2.43.4 above found. Nobody ran `ls-tree -l` there.
    - Git 2.43.0 rejects the option `git --no-lazy-fetch` with exit 129, yet
      it honors `GIT_NO_LAZY_FETCH=1`. So that option does not show whether a
      build has the control.
    - For the corrupt case of the test below, Git 2.50.1 prints `?{hash}` with
      exit 0 for the start-point `rev-list`.

  - On a build without any control (before 2.45 and without the backport),
    `ls-tree -l` lazy-fetches each missing blob in its own fetch process, with
    no time bound. In a partial clone, the full tree owns each such fetch and
    its helpers, so a stop reaches them. A credential prompt fails at once,
    because the new session has no terminal. The full tree adds no time bound.
  - The local test runs put a task-local Git 2.50.1 first on `PATH`, so they
    do not cover older builds.
  - The integration test
    `a_missing_historical_blob_is_git_failed_instead_of_unavailable_validation`,
    at `crates/mokly-cli/tests/changes_failures_tests.rs:154` to line 184,
    deletes one loose blob and expects `git-failed` with the recovery text.
    - Under `/usr/bin/git` 2.43.0 on Ubuntu 24.04.4 LTS, it fails at line 181,
      which expects "base object". Its message is the `bad object` text of the
      evidence below. The code `git-failed` still matches.
    - It failed in two runs in a row on 2026-11-16, so it is not a flaky test.
      With a built Git 2.50.1 and no other change, the same built test passes,
      1 of 1.
    - On that day, `fetch.rs`, this test, and
      `crates/mokly-cli/src/changes_diagnostics.rs` were byte-identical to
      `main` at commit `331bf5d43`.
    - So the repository gate fails on a machine with this packaged Git. No
      document of the repository names a minimum Git version.
  - When the check fails, its command error returns from `ensure_objects` at
    once. So the fetch and `MissingObject` never run. The promisor lookup
    already ran when the repository opened. `build` and `publish` then fail
    with `git-failed`, and Serve shows Changes as unavailable. In a partial
    clone, nothing fetches the missing base blobs.
  - Evidence of 2026-11-17, from a normal repository with one missing blob.
    This is not a partial clone:
    - The fixture had no promisor remote. Its commit held `home.screen.html`.
      The fixture deleted the loose blob of that file,
      `e47a8c6cc358043bbcdf5b0e3e7e4482bd204c37`. Below, `{blob}` stands for
      that id, and `{commit}` for the fixture commit.
    - Three saved release binaries ran Changes against that commit. They were
      built from `331bf5d43`, from `main` at `0b82cf6c0`, and from the branch
      `calummoore/mokly-parallel-view-comparison-n4kr` at `d2ecf20b5`.
    - Under `/usr/bin/git` 2.43.0, the Ubuntu package `1:2.43.0-1ubuntu7.3`,
      all three exited 1 with the same stderr. It names no base object and no
      `git fetch origin` command:

      ```text
      [mokly/git-failed] comparison against base ref "fixture-base" failed: base {commit}: Git exited with status 128: fatal: bad object {blob}
      ```

    - Under Git 2.50.1, built from the kernel.org source, all three exited 1
      with the same typed error:

      ```text
      [mokly/git-failed] comparison against base ref "fixture-base" failed: base {commit}: base object {blob} is missing; run `git fetch origin {blob}`
      ```

    - The base read lists the tree first
      (`crates/mokly-git/src/repository_access.rs:29` to line 50). The
      missing-object check then passes each blob id as a start point to
      `git rev-list --objects --no-object-names --missing=print --stdin`
      (`crates/mokly-git/src/fetch.rs:45` to line 56).
    - With the missing blob id on stdin, that command exited 128 with
      `fatal: bad object {blob}` under Git 2.43.0. Under Git 2.50.1, it exited
      0 and printed `?{blob}`. The user stated on 2026-11-17 that before Git
      2.45, `--missing=print` does not cover a missing start point. Nobody ran
      a 2.45 build.
    - In a scratch repository under the same Git 2.43.0, `ls-tree -r -t -l`
      printed the size `BAD` for a missing blob and exited 0.
      `crates/mokly-git/src/tree.rs:112` accepts that size.
    - In that repository, `git rev-list --objects --no-object-names --missing=print HEAD`
      started from the commit, printed `?{blob}`, and exited 0. Option B also
      starts its check from the tree, so it passes no blob as a start point.
      Nobody has run option B. The probes of 2026-11-16 above ran only its
      core command, a `rev-list` that starts at a tree.
    - So on a Git build before 2.45, a normal clone with a missing blob gets
      Git's `bad object` failure in place of the typed fetch error that
      `docs/protocol/mokly-git.md` line 44 requires. This failure is
      confirmed. The failure of a blobless clone on a backported build, above,
      is still not reproduced. The probes above show that the check itself
      fails in such a clone, but nobody ran the whole base read there.
- **Problem:** On a backported build, a base read of a blobless clone can fail
  before the missing-object check runs. On a build without the control, the
  base read fetches objects one by one with no bound. In both cases the
  protocol text of lines 41 to 44 is false, and no doc names the Git version
  that base reads of a partial clone need.
- **Impact if no action:** A user with a blobless clone and an older Git build
  can get a failed Changes base, or a slow unbounded fetch, with no message
  that names the Git version as the cause.
- **Root question:** How do base reads of a partial clone check and fetch the
  missing objects before any command reads blob sizes, on every Git build that
  Mokly supports?
- **Options:**
  - **A.** Document the Git builds that base reads of a partial clone need, in
    `docs/protocol/mokly-git.md`. It changes no behaviour. Effort: Small.
  - **B.** Run the missing-object check from the commit's tree with the literal
    paths before `ls-tree -l` reads blob sizes, then fetch the missing set in
    one bounded request, then list. A check from the tree reads no blob, so it
    also works before Git 2.45.
    - The check can also start at the parent trees of the requested entries.
      Those trees are present when the entries came from a tree listing. A
      lookup of their ids costs one command, for example one
      `cat-file --batch-check` of `{commit}:{directory}` names.
    - The probes above show that a walk from such a tree prints `?{hash}` for
      a missing blob on Git 2.43.0 and 2.50.1, in a corrupt repository and in
      a partial clone.
    - The output is larger. The 64 MiB output limit of
      `crates/mokly-git/src/command.rs:15` covers common trees.
    - Add a partial-clone regression test. Run it and the test above on Git
      2.43.0 and on a newer Git.
    - Effort: Medium.
  - **C.** Probe the lazy-fetch behaviour once and give a typed error that
    names the Git build when base reads of a partial clone cannot work. It
    adds a new error, which is the user's choice. Effort: Medium.
  - **D.** Probe the start-point behaviour once, and use B only on a Git that
    fails the probe. The probe passes an absent object id as a start point and
    expects `?{hash}` and exit 0. It keeps the cheaper start-point check on
    newer Git, at the cost of two code paths. Effort: Medium.
- **Left out:**
  - Change nothing, because the protocol text stays false.
  - Requiring Git 2.45 or later for every repository, because a normal clone
    works on every build. A check of a minimum version with a typed error
    would best guard against other gaps between Git releases. It adds a
    requirement and a new failure, and it blocks the users of the packaged
    Git of Ubuntu 24.04.
  - Check presence with `git cat-file --batch-check` in place of the
    start-point `rev-list`. It names a missing blob in a corrupt repository on
    Git 2.43.0. In a partial clone on Git 2.43.0 it still exits with status
    128, so the promisor fetch still never runs there.
  - Read the hash from the `fatal: bad object` message. Git translates its
    messages, and `rev-list` stops at the first bad start point, so each
    missing blob needs one more run.
  - Let Git fetch lazily during the check. It breaks "Base reads disable Git's
    lazy fetch while they check object presence" and the one bounded request,
    because Git then fetches one object at a time.
  - One `git cat-file -e` for each blob. It starts one process for each blob,
    and it meets the same promisor failure on Git 2.43.0.
- **Wider fix:** B. It removes the order that makes the failure possible, on
  every build. Its answer does not depend on how a Git release treats a
  missing start point, so a later change of that rule cannot break the fetch.
- **Previous examples:** None found.
- **Related:**
  - No open item. With a promisor remote, `tree_request` in
    `crates/mokly-git/src/repository_command.rs` gives `ls-tree -l` the full
    tree. The callers are `crates/mokly-git/src/repository_access.rs` and
    `crates/mokly-git/src/lookup.rs`. The fix keeps the order of
    the listing and the check, and it adds no time bound. Option B of this
    item is the reorder that the fix did not choose.
- **Recommendation:** B, after a reproduction with a blobless clone on a
  backported build confirms the failure.
- **Action:** ask the user, because no option is clearly best until a
  reproduction with a blobless clone on a backported build confirms the
  failure.
