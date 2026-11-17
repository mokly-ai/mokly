# Blobless base reads can fail on backported Git

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-16, from the branch `calummoore/plain-git-spawns`, review round 1, the check of finding 2.
- **Location:** `crates/mokly-git/src/repository.rs:166` to line 185,
  `crates/mokly-git/src/lookup.rs:51`, and `docs/protocol/mokly-git.md:41`
  to line 44.
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
  - Base reads run `ls-tree -l` first (`crates/mokly-git/src/repository.rs:166`
    and `crates/mokly-git/src/lookup.rs:51`). It reads each blob's size. The
    missing-object check and the one bounded fetch run after it.
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
