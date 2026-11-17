# Blobless base reads can fail on backported Git

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-16, from the branch `calummoore/plain-git-spawns`, review round 1, the check of finding 2.
- **Location:** `crates/mokly-git/src/repository_access.rs:42` to line 61,
  `crates/mokly-git/src/lookup.rs:51`, `crates/mokly-git/src/fetch.rs:45` to
  line 56, and `docs/protocol/mokly-git.md:41` to line 44.
- **Reason:** `origin/main` behaves the same, so the branch that found it does not change it.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Partial clone:** a repository with a promisor remote that omits some
    objects until a command needs them. A blobless clone omits blobs.
  - **Lazy fetch:** Git's automatic fetch of a missing object from the
    promisor remote while an ordinary command reads it.
  - **Lazy-fetch control:** the environment variable `GIT_NO_LAZY_FETCH=1`,
    which `crates/mokly-git/src/system_command.rs` sets for ordinary Git
    commands.
  - **Backported build:** a Git build that got the control from the
    2024-05-14 security releases (2.39.4, 2.40.2, 2.41.1, 2.42.2, 2.43.4,
    2.44.1, their later point releases) or from a distribution patch, such as
    Ubuntu `2.43.0-1ubuntu7.3`, but not the later Git 2.45 code.
- **Background:**
  - `docs/protocol/mokly-git.md`, lines 41 to 44, says: "Base reads disable
    Git's lazy fetch while they check object presence. A promisor remote
    fetches every missing base object in one bounded request before the
    converted read starts." It also says: "Missing objects without a promisor
    remote retain a typed fetch error."
  - Base reads run `ls-tree -l` first
    (`crates/mokly-git/src/repository_access.rs:42` and
    `crates/mokly-git/src/lookup.rs:51`). It reads each blob's size. The
    missing-object check and the one bounded fetch run after it.
  - The source key and the checkout identity hash the checkout settings of the
    whole base commit. They list it through the same `Repository::list`
    method, at `crates/mokly-git/src/source_key.rs:33`. A base computes the
    source key when it looks up or builds its source extraction. A Serve base
    preparation samples the checkout identity before its first base read. The
    check before Serve reuses a kept base samples it again. So these reads
    also run `ls-tree -l` before the missing-object check, for every regular
    file of the commit. When the sample fails for a reason other than
    cancellation, the preparation records no freshness evidence and continues,
    so Serve keeps no base.
  - A check on 2026-11-16 read Git 2.43.4 `promisor-remote.c` and
    `packfile.c`. On a backported build, `GIT_NO_LAZY_FETCH=1` still reaches
    `promisor_remote_get_direct`, and `ls-tree -l` then dies with
    `could not fetch {oid} from promisor remote` at the first missing blob of
    a blobless clone. Nobody reproduced it.
  - On a build without any control (before 2.45 and without the backport),
    `ls-tree -l` lazy-fetches each missing blob in its own fetch process, with
    no time bound.
  - The local test runs put a task-local Git 2.50.1 first on `PATH`, so they
    do not cover older builds.
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
      Nobody has run option B.
    - So on a Git build before 2.45, a normal clone with a missing blob gets
      Git's `bad object` failure in place of the typed fetch error that
      `docs/protocol/mokly-git.md` line 44 requires. This failure is
      confirmed. The failure of a blobless clone on a backported build, above,
      is still not reproduced.
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
    also works before Git 2.45. Effort: Medium.
  - **C.** Probe the lazy-fetch behaviour once and give a typed error that
    names the Git build when base reads of a partial clone cannot work. It
    adds a new error, which is the user's choice. Effort: Medium.
- **Left out:** Change nothing, because the protocol text stays false.
  Requiring Git 2.45 or later for every repository, because a normal clone
  works on every build.
- **Wider fix:** B. It removes the order that makes the failure possible, on
  every build.
- **Related:**
  - `plans/follow-ups/plain-git-promisor-tree-reads.md`: the same `ls-tree -l`
    calls in partial clones, about process ownership on builds without the
    control. Option E of that item is option B of this item.
- **Recommendation:** B, after a reproduction with a blobless clone on a
  backported build confirms the failure.
- **Action:** ask the user, because no option is clearly best until a
  reproduction with a blobless clone on a backported build confirms the
  failure.
