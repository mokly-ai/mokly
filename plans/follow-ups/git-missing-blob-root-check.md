# Missing base blob check fails on Git 2.43

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-16, from branch `calummoore/lisbon-h906`, where the
  repository gate stopped on this unchanged test with Git 2.43.0. The
  diagnosis there put it outside the scope of the bundle disk cache change.
- **Location:** `crates/mokly-git/src/fetch.rs:43` to line 53,
  `crates/mokly-git/src/checkout_index.rs:44` to line 59, and
  `crates/mokly-cli/tests/changes_failures_tests.rs:154` to line 184.
- **Reason:** The failure predates the bundle disk cache change, and its fix
  changes Git code outside that change.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Blob root:** a blob id that a Git command receives directly, on its
    command line or its standard input, and not through the walk of a tree.
  - **Partial clone:** a clone with a filter, such as
    `git clone --filter=blob:none`. It holds the commits and the trees, and it
    fetches each blob from its promisor remote when a reader needs it.
  - **Promisor remote:** a remote that a partial clone fetches missing objects
    from. Its `remote.{name}.promisor` setting is true.
- **Background:**
  - Before the converted read of a base checkout, `ensure_objects` in
    `crates/mokly-git/src/fetch.rs:25` to line 116 checks which blobs are
    missing. `ensure_checkout_objects` in
    `crates/mokly-git/src/checkout_index.rs:44` to line 59 calls it with the
    checkout entries and their `.gitattributes` files.
  - The check, at `fetch.rs:43` to line 53, runs
    `git rev-list --objects --no-object-names --missing=print --stdin` with
    each blob id as a root on standard input. An output line `?{hash}` marks a
    missing blob. Then, for the missing blobs:
    - With a promisor remote, one `git fetch --stdin` fetches all of them, at
      lines 69 to 115.
    - Without a promisor remote, the error `MissingObject` names the recovery
      command, at line 67. Its text, at `crates/mokly-git/src/error.rs:132`,
      is "[mokly-git/fetch] base object {object} is missing; run
      `git fetch origin {object}`".
  - Each Git child runs with `GIT_NO_LAZY_FETCH=1`, at
    `crates/mokly-git/src/system_command.rs:32`.
  - Git 2.43.0 does not print `?{hash}` for a missing blob root. It exits with
    status 128 and `fatal: bad object {hash}`. The command error returns from
    `ensure_objects` at once, so the promisor lookup, the fetch, and
    `MissingObject` never run.
  - Probes of 2026-11-16 in temporary repositories, with
    `GIT_NO_LAZY_FETCH=1`:

    | Command                                                                   | Git 2.43.0, corrupt repository       | Git 2.43.0, partial clone                                      | Git 2.50.1, partial clone           |
    | ------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------- | ----------------------------------- |
    | `rev-list --objects --no-object-names --missing=print --stdin`, blob root | exit 128, `fatal: bad object {hash}` | exit 128, `fatal: bad object {hash}`                           | `?{hash}`, exit 0                   |
    | `cat-file --batch-check`, blob id on standard input                       | `{hash} missing`, exit 0             | exit 128, `fatal: could not fetch {hash} from promisor remote` | `{hash} missing`, exit 0            |
    | The same `rev-list`, with the parent tree of the blob as root             | the tree id, then `?{hash}`, exit 0  | the tree id, then `?{hash}`, exit 0                            | the tree id, then `?{hash}`, exit 0 |
    - The corrupt repository lost one loose blob of an older commit. The
      partial clone is a `file://` clone with `--filter=blob:none` from a
      repository with `uploadpack.allowFilter`.
    - For the corrupt case of the test below, Git 2.50.1 prints `?{hash}` with
      exit 0 for the blob-root `rev-list`.
    - Git 2.43.0 rejects the option `git --no-lazy-fetch`. It honors
      `GIT_NO_LAZY_FETCH=1`: its `cat-file` prints "warning: lazy fetching
      disabled".
    - A Git release between 2.43.0 and 2.50.1 changed how `rev-list` treats a
      missing root. Nobody checked which release.

  - The integration test
    `a_missing_historical_blob_is_git_failed_instead_of_unavailable_validation`,
    at `crates/mokly-cli/tests/changes_failures_tests.rs:154`, deletes one
    loose blob and expects `git-failed` with the recovery text:
    - With Git 2.43.0 it fails at line 181, which expects "base object". The
      message is `[mokly/git-failed] comparison against base ref "fixture-base"
failed: base {commit}: Git exited with status 128: fatal: bad object
{hash}`. The code `git-failed` still matches.
    - It failed in two runs in a row. It is not a flaky test.
    - With a built Git 2.50.1 and no other change, the same built test passes,
      1 of 1.
    - `fetch.rs`, this test, and `crates/mokly-cli/src/changes_diagnostics.rs`
      are byte-identical to `main` at commit `331bf5d43`.
  - The machine of these runs is Ubuntu 24.04.4 LTS with its packaged Git,
    `1:2.43.0-1ubuntu7.3`. No document of the repository names a minimum Git
    version.
  - These requirements are in force:
    - `docs/protocol/mokly-git.md:35` to line 38: "Base reads disable Git's
      lazy fetch while they check object presence. A promisor remote fetches
      every missing base object in one bounded request before the converted
      read starts. A failed fetch names a recovery `git fetch` command. Missing
      objects without a promisor remote retain a typed fetch error."
    - `docs/protocol/mokly-base-preparation.md:51` to line 52: genuine Git
      command and object failures stay fatal `git-failed` errors. Lines 57 to
      58: "A failed fetch of missing objects names the recovery command."
- **Problem:** On Git 2.43.0 the missing-object check fails on a missing blob
  root instead of naming it. So a partial clone gets no promisor fetch, and a
  missing object gets no recovery command.
- **Impact if no action:**
  - In a partial clone on Git 2.43.0, nothing fetches the missing base blobs.
    So `build` and `publish` fail with `git-failed`, and Serve shows Changes as
    unavailable.
  - A repository that lost an object reports `fatal: bad object {hash}` and no
    recovery command.
  - The repository gate fails on a machine with Git 2.43.0.
- **Root question:** How does the base read find its missing blobs on each Git
  version that users run, so that the promisor fetch and the typed recovery
  error still run?
- **Options:**
  - **A.** Check presence with `git cat-file --batch-check` in place of the
    blob-root `rev-list`. It names a missing blob in a corrupt repository on
    Git 2.43.0. In a partial clone on Git 2.43.0 it still exits with status
    128, so the promisor fetch still never runs there. Effort: Small.
  - **B.** Start the same `rev-list` at present trees, and keep only the
    requested blob ids from its output.
    - The roots are the parent trees of the entries, or the root tree of the
      base commit. The entries came from a tree listing, so their trees are
      present.
    - A missing blob that the walk reaches prints `?{hash}` on Git 2.43.0 and
      Git 2.50.1, in a corrupt repository and in a partial clone.
    - Cost: one lookup of the parent tree ids, for example one
      `cat-file --batch-check` of `{commit}:{directory}` names. The output is
      larger. The 64 MiB output limit of `crates/mokly-git/src/command.rs:15`
      covers common trees.
    - Add a partial-clone regression test. Run it and the test above on Git
      2.43.0 and on a newer Git.
    - Effort: Medium.
  - **C.** Probe the behaviour once, and use B only on a Git that fails the
    probe. The probe passes an absent object id as a blob root and expects
    `?{hash}` and exit 0. It keeps the cheaper blob-root check on newer Git,
    at the cost of two code paths. Effort: Medium.
  - **D.** Name a minimum Git version, check it, and fail with a typed error
    that names that version. Nobody knows the first fixed release yet. It
    adds a requirement and a new failure, and it blocks the users of the
    packaged Git of Ubuntu 24.04. Effort: Medium.
- **Left out:**
  - Change nothing. It breaks the fetch and recovery rules of
    `docs/protocol/mokly-git.md` on Git 2.43.0.
  - Read the hash from the `fatal: bad object` message. Git translates its
    messages, and `rev-list` stops at the first bad root, so each missing blob
    needs one more run.
  - Let Git fetch lazily during the check. It breaks "Base reads disable Git's
    lazy fetch while they check object presence" and the one bounded request,
    because Git then fetches one object at a time.
  - One `git cat-file -e` for each blob. It starts one process for each blob,
    and it meets the same promisor failure on Git 2.43.0.
- **Wider fix:** B. Its answer does not depend on how a Git release treats a
  missing root, so a later change of that rule cannot break the fetch.
- **Previous examples:** None found.
- **Recommendation:** B. It restores the required fetch and recovery on every
  probed version, with one code path and no new requirement. D best guards
  against other gaps between Git releases, but it blocks the users of Git
  2.43.0.
- **Action:** fix after merge, apply B, because the bug predates the bundle
  disk cache change and its fix belongs to the Git crate outside that change.
  B restores existing requirements, so no condition of the decision test
  holds.
