# Module source reads wait for a FIFO writer

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from review round 1 of branch
  `calummoore/mokly-edit-bundle-path-kv2o`, which listed it outside the scope.
- **Location:** `packages/mokly/src/sidecar/plugins.ts:63`, the file load
  callback of the `mokly-consumer` plugin.
- **Reason:** The branch that found it did not change this callback, and the
  open item for FIFO waits leaves module source reads out as a separate
  question.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **FIFO:** a named pipe that `mkfifo` creates. On Linux and macOS, an open
    for reading waits for a writer unless the open sets `O_NONBLOCK`.
  - **Load callback:** the esbuild `onLoad` callback that reads the bytes of
    each consumer module for a compile.
- **Background:**
  - The load callback reads each module with `fs.readFileSync(args.path)` at
    line 63. When that call throws, it tries the asynchronous `fs.readFile`
    at line 67.
  - Both reads open the path without `O_NONBLOCK`. So a FIFO without a writer
    at a module path stops the synchronous read, and the main thread of the
    sidecar stops with it.
  - The deadline of a `bundle` request is 120 seconds. Then the binary kills
    the sidecar, retries once on a fresh sidecar, and fails with
    `render-timeout`. `docs/protocol/mokly-sidecar-lifecycle.md` gives these
    rules.
  - The sidecar's reuse read in `packages/mokly/src/sidecar/file-digests.ts`
    already opens with `O_RDONLY | O_NONBLOCK` and rejects a file that is not
    regular.
  - `plans/follow-ups/evidence-metadata-fifo-open.md` holds the same wait in
    the evidence and digest reads. Its **Left out** line names this callback
    as a separate question, because its asynchronous fallback needs its own
    rule.
  - Git cannot store a FIFO. A local tool or person must create it at a
    module path. Nobody reproduced the wait, because such a run blocks.
- **Problem:** A FIFO at a module path stops the compile until the request
  deadline, and the retry stops again.
- **Impact if no action:** Such a compile fails with `render-timeout` after
  about 240 seconds, not at once with a clear error.
- **Root question:** How does the compile's module read fail at once when a
  module path holds a FIFO or another special file?
- **Options:**
  - **A.** Open each module with `O_RDONLY | O_NONBLOCK`, check that the
    handle is a regular file, then read it, before the asynchronous fallback.
    A path that is not a regular file fails with a clear error. Effort: Small.
  - **B.** A, through the one sidecar open rule that option B of
    `plans/follow-ups/evidence-metadata-fifo-open.md` proposes, so the load
    callback, the evidence reads, and the digest reads share one rule.
    Effort: Medium.
- **Left out:** A kind check before the open alone: a path that changes to a
  FIFO between the check and the open still waits.
- **Wider fix:** B. One open rule then serves every sidecar read of a
  consumer path.
- **Previous examples:** the reuse read of `file-digests.ts` gained its
  non-waiting open on 2026-11-20.
- **Related:**
  [evidence-metadata-fifo-open.md](./evidence-metadata-fifo-open.md) holds the
  same wait in the evidence and digest reads. One branch can fix both.
- **Recommendation:** B. It closes this case with the open rule of the
  related item.
- **Action:** fix after merge, apply B, because the callback is outside the
  branch that found it, and the related item needs its own branch.
