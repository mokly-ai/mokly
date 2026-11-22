# Consumer file opens wait for a FIFO writer

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from the options check of the plan for synchronous
  reuse reads, on branch `calummoore/mokly-sync-reuse-digests-8fcm`. The
  orchestrator of that branch and its docs implementor confirmed the problem
  in the code. Widened on 2026-11-22 by review finding 1 of round 1 of branch
  `calummoore/mokly-edit-bundle-path-kv2o`, Medium and Rare, which found the
  same order in the pool's new source digest read, and by its check, which
  found it in the catalogue's working tree read.
- **Location:** `packages/mokly/src/sidecar/physical-input-reader.ts:41` to
  line 58, `packages/mokly/src/sidecar/physical-input-reader.ts:233` to line
  236, `packages/mokly/src/sidecar/physical-inputs.ts:145` to line 153,
  `crates/mokly-render/src/physical_inputs.rs:49` to line 57,
  `crates/mokly-sidecar/src/source_digests.rs:23` (`SystemSourceDigests::digest`),
  and `crates/mokly-catalogue/src/working_tree_read.rs:18` (`open`).
- **Reason:** The task of that branch keeps `currentEvidence` unchanged, and
  the same wait exists on `main`, so the fix needs its own branch.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Reuse evidence:** the record of each file, directory list, absent path,
    and link that decides which file each import of a compiled bundle
    selects.
  - **Metadata file:** a configuration, manifest, or PnP state file that the
    reuse evidence records with its digest.
  - **FIFO:** a named pipe that `mkfifo` creates.
  - **Special file:** a FIFO, a socket, or a device file.
- **Background:**
  - The sidecar records reuse evidence in a `full` compile. It checks the
    evidence again before it reuses the compilation.
  - A Serve edit compilation with the `uncaptured: "serveEdit"` marker gets
    the same file checks for its private folder files.
  - `PhysicalInputReader.readMetadata`, at
    `packages/mokly/src/sidecar/physical-input-reader.ts:41`, reads one
    metadata file with synchronous calls.
  - It returns `absent` when `statSync` finds no entry. Otherwise it calls
    `fs.openSync(file, "r")`, at line 46.
  - Only after that open does `fstatSync` reject a file that is not regular,
    at lines 52 to 58.
  - Capture reaches `readMetadata` through `PhysicalInputs.freshMetadata`, at
    `packages/mokly/src/sidecar/physical-inputs.ts:145` to line 153.
  - Each reuse check reaches it through the `file` case of `entriesCurrent`,
    at `physical-input-reader.ts:233` to line 236. `currentEvidence` and
    `markedCurrent` use that function.
  - The binary checks the same evidence with `SystemPhysicalInputs::read`, at
    `crates/mokly-render/src/physical_inputs.rs:49` to line 57. It calls
    `File::open` before `is_file`.
  - Since 2026-11-22, the pool reads the current digest of a source before it
    sends a released recipe, in `SystemSourceDigests::digest` at
    `crates/mokly-sidecar/src/source_digests.rs:23`. It calls `File::open`
    before its regular-file check. So a FIFO at a recorded module path stops
    the Serve edit before its `bundle` call, with no deadline, and the request
    keeps its pool process leased. The release rules in
    `docs/protocol/mokly-sidecar-release.md` say that a source that cannot be
    read rules nothing out.
  - `open` in `crates/mokly-catalogue/src/working_tree_read.rs:18`, which
    `WorkingTree::read` and `WorkingTree::digest` call, opens a consumer path
    with `O_NOFOLLOW` but without `O_NONBLOCK`, and it checks the file kind
    after the open.
  - The binary runs that check while it chooses a retained compilation, at
    `crates/mokly-render/src/bundle.rs:62` to line 75. It also runs it for a
    saved Serve edit plan, at `crates/mokly-render/src/bundle_attempt.rs:70`.
    Both checks run before any `bundle` request.
  - On Linux and macOS, an open for reading of a FIFO waits until a writer
    opens the FIFO. With `O_NONBLOCK`, the open returns at once.
  - The deadline of a `bundle` request is 120 seconds. Then the binary kills
    the sidecar, retries once on a fresh sidecar, and fails with
    `render-timeout`. `docs/protocol/mokly-sidecar-lifecycle.md` gives these
    rules.
  - Git cannot store a FIFO, so a checkout does not bring one. A local tool
    or person must create it at a recorded path.
  - The code and the POSIX rule for `open` show the wait. No run reproduced
    it, because such a run blocks.
  - The task of 2026-11-20 for synchronous reuse reads kept `currentEvidence`
    unchanged, as its task message required.
  - Requirements that each option keeps, from
    `docs/protocol/mokly-sidecar-recipes.md`, section "Reuse And Identity":
    - A compilation is reused only while its inputs stay unchanged.
    - A candidate that cannot be read never matches a recorded absence.
    - A `full` capture that cannot record its evidence completely is never
      reused and never stored.
    - The binary checks the same evidence when it reuses a result without a
      `bundle` request.
  - These rules already define the result for a special file. So an open
    that does not wait adds no behaviour that needs a user decision.
- **Problem:** `readMetadata` rejects only an absent path before
  `fs.openSync(file, "r")`, and its regular-file check runs after the open
  returns. So a FIFO without a writer at a recorded metadata path makes the
  open wait, and the main thread of the sidecar stops. The Rust matcher, the
  pool's source digest read, and the catalogue's working tree read have the
  same order, so the same FIFO stops the binary.
- **Impact if no action:** A sidecar that meets the FIFO stops until the
  120-second deadline, and the retry can stop again before `render-timeout`.
  In the binary, the same FIFO stops the bundle preparation, and no sidecar
  deadline covers that wait.
- **Root question:** How does each evidence check and each digest read of a
  consumer file fail closed at once when the path holds a FIFO or another
  special file?
- **Options:**
  - **A.** Open with `O_NONBLOCK` in both checks, and keep each regular-file
    check after the open. `readMetadata` uses
    `fs.constants.O_RDONLY | fs.constants.O_NONBLOCK`. On Unix, the Rust
    matcher uses `OpenOptions` with `custom_flags(libc::O_NONBLOCK)`, which
    adds `libc` to `crates/mokly-render/Cargo.toml`. Effort: Small.
  - **B.** A, through one open rule. In the sidecar, one helper opens a
    consumer path without waiting and rejects a file that is not regular.
    `readMetadata` and `fileDigest` both use it. The Rust matcher gets the
    flags of A. Effort: Medium.
  - **C.** B, plus one Rust helper for every Rust read of a consumer file:
    `SystemSourceDigests::digest`, the matcher in
    `crates/mokly-render/src/physical_inputs.rs`, `open` in
    `crates/mokly-static/src/file_read.rs:15`, and `open` in
    `crates/mokly-catalogue/src/working_tree_read.rs:18`. One function opens
    without waiting, with a choice not to follow the final link, and rejects a
    file that is not regular. A second function returns the lowercase SHA-256
    hex. `crates/mokly-source-interface` can hold them: it already has `libc`
    on Unix, `sha2`, and `copy_verified`, and the render, static, and
    catalogue crates depend on it. Its tests give the SHA-256 of `abc`, and
    they show the non-waiting open through the `O_NONBLOCK` flag of the opened
    handle, because a real FIFO test waits forever on the old code.
    Effort: Medium.
  - **D.** C, plus a `clippy.toml` with `disallowed-methods` in those crates.
    It rejects `std::fs::File::open`, `std::fs::read`, and
    `std::fs::read_to_string`, so a new read uses the helper or carries an
    allow with a reason. It adds a lint, so it needs the user. Effort: Medium.
  - **E.** Move the pool's read into the sidecar, which already opens without
    waiting. The pool sends one small call with the paths whose digests
    differ. It adds a method to `docs/protocol/mokly-sidecar.md`, wire types,
    and one round trip for each warm edit, so it needs the user. It also
    removes the pool's copy of the sidecar's input rule, so that rule cannot
    drift between the two readers, for a recorded absence or for a later
    recorded kind. Effort: Large.
- **Left out:**
  - A kind check before the open alone: a path that changes to a FIFO
    between the check and the open still waits.
  - An asynchronous open or a worker thread: the open still waits for a
    writer, so the check never fails closed before the deadline.
  - A lint that rejects a blocking open: it cannot tell a consumer path from
    a Mokly file, and a new lint needs the user.
  - A change to the module source read: `packages/mokly/src/sidecar/plugins.ts:61`
    also opens a consumer path without `O_NONBLOCK`. It serves the compile,
    not an evidence check, and its asynchronous fallback at line 65 needs its
    own rule. So it is a separate question.
  - Change nothing: a FIFO keeps stopping a sidecar until the deadline.
- **Wider fix:** C. One open rule in each language then serves every
  evidence and digest read of a consumer file. Only D keeps a new Rust read on
  the helper, and D needs the user, because it adds a lint.
- **Previous examples:**
  - The task of 2026-11-20 for synchronous reuse reads gave `fileDigest` in
    `packages/mokly/src/sidecar/file-digests.ts` this order:
    `O_RDONLY | O_NONBLOCK`, then the regular-file check. Its earlier
    asynchronous open waited on a FIFO in the same way.
  - `open` in `crates/mokly-static/src/file_read.rs:15` sets
    `O_NOFOLLOW | O_NONBLOCK` on Unix, then checks for a regular file.
  - `confined` in `crates/mokly-catalogue/src/working_tree_stream.rs:35` sets
    `O_NONBLOCK` on Unix, then checks for a regular file.
- **Related:**
  [module-source-read-fifo-wait.md](./module-source-read-fifo-wait.md) holds
  the same wait in the compile's module read. One branch can fix both.
- **Recommendation:** C. It closes every known case and keeps the evidence and
  digest reads of each language on one open rule. The first recommendation was
  B, before the Rust readers joined this item.
- **Action:** fix after merge, apply C, because the reads are in the sidecar
  and in four crates, outside the changes that found them, so this fix needs
  its own branch and tests.
