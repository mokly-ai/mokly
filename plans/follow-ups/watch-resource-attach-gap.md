# Recover resource edits before directory attachment

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Large. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #222 and its completed plan, which put the
  problem outside the scope of its first review.
- **Location:** `crates/mokly-graph/src/session_render.rs:137`,
  `crates/mokly-cli/src/serve_watch.rs:269`, and
  `crates/mokly-cli/src/serve_watch_events.rs:17` and line 52.
- **Reason:** The gap exists on `origin/main` outside the diff of PR #222,
  whose new file-time check covers only the inputs of a preparation.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Resource:** an authored file, such as an image, a font, or a
    stylesheet asset, that a composed document references.
  - **Watch plan:** the roots and exact files that the native watcher of
    `mokly-watch` observes.
- **Background:**
  - Watched Serve renders documents on demand. When a render reaches a
    resource, `ClosureObserver::observe` in
    `crates/mokly-graph/src/session_render.rs:137` reads and digests the
    file. It records the digest under the document's resource key.
  - It then reports the path to the watch layer. `WatchedInputs::observe`
    in `crates/mokly-cli/src/serve_watch.rs:269` queues the path.
  - Later, `drain` in `crates/mokly-cli/src/serve_watch_events.rs:17` adds
    the queued paths to the watch plan. At line 52 it attaches the native
    watcher to their directories.
  - PR #222, merged on 2026-10-28, added a check for the exact input files
    of a preparation. After the candidate's watcher attaches, Serve replays
    a change for each such file whose modification time falls after the
    preparation start. `changed` in
    `crates/mokly-cli/src/serve_watch_files.rs:64` implements it. The
    check does not run for a resource that a render reaches later.
- **Problem:** An edit to the resource between the digest and the directory
  attachment makes no native event. Serve keeps the old digest and the old
  rendered document. The same gap exists on `origin/main` before PR #222.
- **Impact if no action:** The served document can show an old image or
  style until another edit touches the same inputs. The watch contract at
  `docs/protocol/mokly-watch.md:52` says that an edit to a referenced
  resource recomputes the documents that reference it.
- **Root question:** How does watched Serve see an edit to a resource that a
  render read before the watcher observed its directory?
- **Options:**
  - **A.** State the gap as a known limit in `docs/protocol/mokly-watch.md`,
    and change no code. Effort: Small.
  - **B.** Record the time when `WatchedInputs` queues each new resource.
    After `drain` attaches the new directories, read the modification time
    of each new resource. Replay a change event when it falls after the
    recorded time, with the margins of the preparation check. Effort:
    Medium.
  - **C.** Pass the recorded digest with each new resource to the watch
    layer. After the attachment, digest each new resource again and replay
    a change event when the digests differ. This changes the
    `ResourceObserver` boundary of `mokly-graph` and the CLI. Effort: Large.
  - **D.** Attach the watcher to the directory before the render reads the
    file, through a synchronous call from the graph to the watch layer.
    Each render then waits for watcher IO. Effort: Large.
- **Left out:** Change detection inside the watch layer without a separate
  check. PR #222 rejected it as Large for the preparation case on
  2026-10-28, and B covers this narrower case.
- **Wider fix:** D. The watcher then observes each resource
  before its first read, so no gap remains.
- **Previous examples:** PR #222 fixed the same class for the exact input
  files of a preparation on 2026-10-28, through the file-time check in
  `crates/mokly-cli/src/serve_watch_files.rs:64`.
- **Related:**
  [native-watch-event-recovery.md](./native-watch-event-recovery.md) covers
  events that the native watcher loses on macOS and Windows in a directory
  that it already observes. This item covers edits before the watcher
  observes the directory. Both are cases of one class, a watched change
  that Serve misses, but their causes and fixes differ. One branch can test
  both.
- **Recommendation:** D. Observation before the read removes the attachment gap
  instead of inferring edits from modification times. The record first
  recommended B.
- **Action:** fix after merge, apply D, because the resource attachment gap lies
  outside the preparation check that found it.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/render-cache-weight-and-watch-recheck.md?plain=1#L428).
