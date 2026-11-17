# Missing-object check fails on older Git

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from the branch `calummoore/mokly-mimalloc-global-allocator-i7qn`, its `cargo test -p mokly-cli` run with Git 2.43.0.
- **Location:** `crates/mokly-git/src/fetch.rs:45` to line 71, and
  `crates/mokly-cli/tests/changes_failures_tests.rs:153` to line 184.
- **Reason:** The check is code of `main` at `0b82cf6c0`, and the allocator branch that found the failure changes no Git code.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Changes:** Mokly's comparison of the catalogue with a base commit, the
    merge base of `HEAD` and the ref that `mokly build --base` names.
  - **Missing-object check:** `GitRepository::ensure_objects` in
    `crates/mokly-git/src/fetch.rs`, which finds the absent base blobs before
    checkout reads and fetches them from a promisor remote.
  - **Lazy fetch:** Git's automatic fetch of an absent object from a promisor
    remote, the remote that a partial clone marks with `remote.{name}.promisor`.
  - **Missing tip:** an object ID that `git rev-list` gets as a starting
    point, here on standard input, while the object is absent.
  - **Missing-object error:** `Error::MissingObject` of
    `crates/mokly-git/src/error.rs:132`, which the terminal shows as
    `` base object {oid} is missing; run `git fetch origin {oid}` ``.
- **Background:**
  - The missing-object check runs
    `git rev-list --objects --no-object-names --missing=print --stdin` at
    `crates/mokly-git/src/fetch.rs:45` to line 56. It writes each needed blob
    ID to standard input, so each ID is a tip.
  - It reads each output line with a `?` prefix as a missing object. Without
    a promisor remote, it returns the missing-object error. With one, it
    fetches the missing set in one bounded `git fetch --stdin`.
  - When `rev-list` fails, the check returns that Git failure at once.
  - `docs/protocol/mokly-git.md`, lines 41 to 44, says: "Base reads disable
    Git's lazy fetch while they check object presence. A promisor remote
    fetches every missing base object in one bounded request before the
    converted read starts. A failed fetch names a recovery `git fetch`
    command. Missing objects without a promisor remote retain a typed fetch
    error."
  - The test
    `a_missing_historical_blob_is_git_failed_instead_of_unavailable_validation`
    in `crates/mokly-cli/tests/changes_failures_tests.rs:153` checks the last
    rule. It commits `specs/home.screen.html`, deletes the loose object of
    that blob, and runs `mokly build --base fixture-base`. Line 181 expects
    `base object`, and line 182 expects `git fetch origin`.
  - The Git 2.45.0 release notes say that `rev-list --missing=print` now
    "allows the objects at the starting points to be missing". The note
    names a flag `--allow-missing-tips`, but Git 2.50.1 has no such flag. Its
    `rev-list --missing` text says that missing tips "will be considered as
    missing too".
  - On 2026-11-17, `cargo test -p mokly-cli` with Git 2.43.0 failed this test
    at line 181. The command gave exit status 1 and the right
    `[mokly/git-failed]` category, with this text:

    ```text
    [mokly/git-failed] comparison against base ref "fixture-base" failed: base {commit}: Git exited with status 128: fatal: bad object e47a8c6cc358043bbcdf5b0e3e7e4482bd204c37
    ```

  - The exact rerun of that one test failed in the same way at line 181. With
    Git 2.50.1 first on `PATH`, the test passes.
  - A controlled check ran one unchanged release binary of `331bf5d43` on the
    same fixture, and changed only the Git on `PATH`. Git 2.43.0 gave the text
    above. Git 2.50.1 gave this text:

    ```text
    [mokly/git-failed] comparison against base ref "fixture-base" failed: base {commit}: base object e47a8c6cc358043bbcdf5b0e3e7e4482bd204c37 is missing; run `git fetch origin e47a8c6cc358043bbcdf5b0e3e7e4482bd204c37`
    ```

  - Release binaries of `331bf5d43` and of the allocator branch gave the same
    Git 2.43.0 text. The failure is the same in each run, so it is not a
    flaky test and not an allocator regression.
  - The blob ID is the same in each run, because the file content is fixed.
    The commit ID changes with the commit time, so the texts show `{commit}`.
  - To reproduce it, set `MOKLY_BIN` to the absolute path of a `mokly` binary
    of this repository. Put the Git under test first on `PATH`, then run:

    ```bash
    export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
    cd "$(mktemp -d)"
    mkdir specs
    printf '{}' > mokly.config.json
    printf -- '---\ntitle: Home\n---\n<p>Home</p>' > specs/home.screen.html
    git init -q --initial-branch=fixture-base
    git add .
    git -c user.name=Fixture -c user.email=fixture@example.test commit -q -m fixture
    missing=$(git rev-parse HEAD:specs/home.screen.html)
    present=$(git rev-parse HEAD:mokly.config.json)
    rm ".git/objects/${missing:0:2}/${missing:2}"
    printf '%s\n%s\n' "$missing" "$present" |
      git rev-list --objects --no-object-names --missing=print --stdin
    echo "exit $?"
    MOKLY_OUTPUT=plain "$MOKLY_BIN" build --base fixture-base
    ```

    - `missing` is `e47a8c6cc358043bbcdf5b0e3e7e4482bd204c37`, and `present`
      is `9e26dfeeb6e641a33dae4961196235bdb965b21b`.
    - Git 2.43.0 prints
      `fatal: bad object e47a8c6cc358043bbcdf5b0e3e7e4482bd204c37` and
      `exit 128`.
    - Git 2.50.1 prints `9e26dfeeb6e641a33dae4961196235bdb965b21b`, then
      `?e47a8c6cc358043bbcdf5b0e3e7e4482bd204c37`, and `exit 0`.
    - `mokly build` then prints the text of the controlled check for that Git.
    - The test reproduces it too. Run
      `cargo test -p mokly-cli --test changes_failures_tests a_missing_historical_blob`
      with Git 2.43.0 first on `PATH`.
- **Problem:** On Git before 2.45.0, the missing-object check stops at a
  missing tip with `fatal: bad object {oid}` and exit status 128. Mokly then
  reports that raw Git failure, so the missing-object error and its
  `git fetch origin {oid}` command never appear. That breaks the rule of
  `docs/protocol/mokly-git.md`, line 44, and the CLI test of that rule fails.
- **Impact if no action:** Users of Git before 2.45.0 get a raw `bad object`
  failure for a missing base blob, without the recovery command. On such a
  machine, `cargo test -p mokly-cli` and
  `cargo xtask check --suite repository` fail until a newer Git comes first on
  `PATH`.
- **Root question:** How does a base read find each missing base blob on every
  Git version, so that the typed error and the bounded fetch apply?
- **Options:**
  - **A.** Make the missing-object check portable in a separate narrow
    change. It must report a missing tip in the same way on Git 2.43.0 and
    Git 2.50.1. It must still start no lazy fetch, as line 41 of the protocol
    requires. On the fixture, adding `--ignore-missing` to the current
    arguments made both versions print only the present blob. The check can
    then treat each requested ID that the output omits as missing. Keep every
    assertion of the CLI test. Effort: Small.
  - **B.** Keep the current behaviour. Users of older Git keep the raw Git
    failure, and the CLI test keeps failing on those machines. Effort: Small.
  - **C.** Require a newer Git. State a minimum Git version in
    `docs/protocol/mokly-git.md`, and reject older Git with a typed error. It
    adds a new requirement and a new rejection, which are the user's choice.
    It also stops users of older Git who never meet a missing object. Effort:
    Medium.
- **Left out:**
  - Map the `fatal: bad object {oid}` text to the missing-object error,
    because it depends on the wording of a Git message, and option A has no
    such cost.
  - Skip the test, weaken an assertion, rerun it, or raise a time limit,
    because the failure is the same in each run, and these changes only hide
    the defect.
  - Run the local tests only with a newer Git, because users of older Git
    keep the defect.
- **Assumptions:**
  - A missing base blob without a promisor remote ends in the missing-object
    error with its `git fetch origin {oid}` command. Source:
    `docs/protocol/mokly-git.md`, line 44. That requirement stays.
  - The CLI test keeps every assertion. Source: the request that added this
    item, on 2026-11-17. The reason holds, because the assertions state the
    protocol result.
- **Wider fix:** A. A portable form of the one shared check removes the
  version difference where it starts. `ensure_objects` has one caller,
  `crates/mokly-git/src/checkout_index.rs:52`. Option C is a guard, and it
  needs a new requirement.
- **Previous examples:** `plans/follow-ups/plain-git-promisor-tree-reads.md`
  and `plans/follow-ups/partial-clone-lazy-fetch-builds.md`, both of
  2026-11-16, record other base-read Git commands that behave differently
  before Git 2.45.0.
- **Related:**
  - `plans/follow-ups/partial-clone-lazy-fetch-builds.md`: base reads of a
    blobless clone on Git builds before 2.45.0. Its option B, a
    missing-object check that walks from the commit's tree, would also remove
    this failure. Either fix can land first.
  - `plans/follow-ups/plain-git-promisor-tree-reads.md`: it relies on
    `rev-list --missing=print` starting no lazy fetch. Option A keeps that
    property.
- **Recommendation:** A. It is the smallest change that gives the same result
  on Git 2.43.0 and Git 2.50.1, and it needs no minimum Git version.
- **Action:** fix after merge, apply A, because the check is code of `main`
  that the allocator branch does not change.
