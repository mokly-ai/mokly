# Plain tree reads can lazy-fetch on old Git

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-16, from the branch `calummoore/plain-git-spawns`, review round 1, finding 2.
- **Location:** `crates/mokly-git/src/repository_access.rs:42` to line 61,
  `crates/mokly-git/src/lookup.rs:51`, and `crates/mokly-git/src/fetch.rs:122`.
- **Reason:** It needs both a partial clone and a Git build without the lazy-fetch control, so the outcome rules defer a fix of a Rare problem that is not High.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Plain group:** the process mode `ProcessMode::PlainGroup` of
    `crates/mokly-git/src/command.rs`. The child starts in its own process
    group, in the core's session, with no `pre_exec` hook and no Linux
    subreaper.
  - **Full tree:** the default mode `ProcessMode::FullTree`. The child starts
    a new session and, on Linux, becomes a subreaper.
  - **Partial clone:** a repository with a promisor remote that omits some
    objects, for example blobs, until a command needs them.
  - **Lazy fetch:** Git's automatic fetch of a missing object from the
    promisor remote while an ordinary command reads it.
  - **Lazy-fetch control:** the environment variable `GIT_NO_LAZY_FETCH=1`,
    which `crates/mokly-git/src/system_command.rs` sets for ordinary commands.
- **Background:**
  - On 2026-11-16 the plain group was chosen for `ls-tree` and other commands
    that start no other process. It relies on `GIT_NO_LAZY_FETCH=1`.
  - Git added the control in 2.45.0, and the 2024-05-14 security releases
    backported it to 2.39.4, 2.40.2, 2.41.1, 2.42.2, 2.43.4, and 2.44.1.
    Distribution builds carry it too, for example Ubuntu `2.43.0-1ubuntu7.3`.
    Git 2.43.0 to 2.43.3 and other builds without the backport ignore it.
  - `ls-tree -l` reads each blob's size. On a build without the control, a
    missing blob starts a lazy fetch (`object-file.c`, Git 2.43.0, line 1623,
    which calls the promisor fetch path). Git starts a lazy fetch only when the
    repository has a promisor remote.
  - The two plain `ls-tree -l` calls are
    `crates/mokly-git/src/repository_access.rs:42` and
    `crates/mokly-git/src/lookup.rs:51`. The missing-object check that
    fetches every missing base object in one bounded request runs after them.
  - The source key and the checkout identity hash the checkout settings of the
    whole base commit. They list it through the first of these calls, at
    `crates/mokly-git/src/source_key.rs:33`. A base computes the source key
    when it looks up or builds its source extraction. A Serve base preparation
    samples the checkout identity before its first base read. The check before
    Serve reuses a kept base samples it again. So in a partial clone on a build
    without the control, each of these listings can start a lazy fetch for
    each missing blob of the commit.
  - `fetch.rs:122` already reads the promisor remotes with a helper-free
    `config` command.
  - `rev-list --missing=print` sets `fetch_if_missing = 0` on every build that
    has the option, so it does not lazy-fetch.
- **Problem:** On a build without the control, a plain `ls-tree -l` in a partial
  clone can start `git fetch` with its network and credential helpers inside
  the plain group. A helper that starts its own session escapes a stop on
  Linux, because no subreaper adopts it. Also, the plain group stays in the
  core's session, so a credential or SSH prompt can reach the Serve terminal,
  and the read then stops (`SIGTTIN`) until a cancellation. The full tree
  calls `setsid`, so there the prompt fails at once.
- **Impact if no action:** In a partial clone on an old unpatched Git build, a
  base read can leave a network helper running after a stop, or wait for a
  terminal prompt until a cancellation.
- **Root question:** How can a tree read start without a fork of the core, and
  still own each process that Git can start for it, on every Git build and in
  every repository?
- **Options:**
  - **A.** Keep the object-reading commands on the full tree for every Git
    version. It gives up the speed of the plain start for every repository.
    Effort: Small.
  - **B.** Check the lazy-fetch control once, by behaviour, not by version
    number (`git --no-lazy-fetch version` exits 129 on a build without it),
    and select the full tree when the control is absent or unknown. Effort:
    Medium.
  - **C.** Start every managed child through the spawn trampoline of
    `plans/follow-ups/managed-child-spawn-trampoline.md`. Effort: Large.
  - **D.** Keep `ls-tree` on the full tree in a repository with a promisor
    remote, and use the plain group in every other repository. Read the
    promisor remotes once for each opened repository with the helper-free
    `config` read of `fetch.rs:122`, and add `extensions.partialClone`. Build
    both `ls-tree` requests through one helper that picks the mode from that
    answer. Keep `rev-parse`, `merge-base`, and `rev-list --missing=print` on
    the plain group. Add request-capture cases for a repository with a
    promisor remote and for one without. Cost: tree reads in a partial clone
    lose the plain start, and each opened repository starts one more plain
    `config` command. Effort: Small.
  - **E.** Find the missing blobs before any command reads blob sizes: run the
    missing-object check from the commit's tree with the literal paths, fetch
    the missing set on the full tree, then run `ls-tree -l` on the plain
    group. It keeps the plain start everywhere, but it reorders the tree reads
    and makes a tree-filtered clone with a missing root tree fail at once on
    builds before 2.45. Effort: Medium.
- **Left out:** Reject older Git versions, because a version number cannot
  find the backported control, and a new rejection is the user's choice.
  Block the transports with `-c protocol.allow=never`, because the blocked
  fetch makes `ls-tree` fail and a `git fetch` process still starts. A plain
  spawn in a new session, because it gives no Linux subreaper. Turn off
  prompts only, because it stops the terminal symptom and not the escape.
- **Wider fix:** C. B, D, and E must know the lazy-fetch detail, so they are
  direct fixes. Only C still prevents the class when that detail changes.
- **Related:**
  - `plans/follow-ups/plain-git-fsmonitor-override.md`: the same cause, a
    plain command that a configuration or a Git build makes start a process.
  - `plans/follow-ups/managed-child-spawn-trampoline.md`: option C.
  - `plans/follow-ups/partial-clone-lazy-fetch-builds.md`: base reads of a
    blobless clone on builds that carry only the backported control.
- **Recommendation:** D. It closes the gap on every Git build at Small effort,
  needs no probe of the Git binary, and keeps the plain start in every
  repository without a promisor remote, which is the normal case.
- **Action:** fix after merge, apply D, because the problem needs a partial
  clone on an old unpatched Git build, and the fix does not get harder after
  the merge. The wider fix C stays in its own item.
