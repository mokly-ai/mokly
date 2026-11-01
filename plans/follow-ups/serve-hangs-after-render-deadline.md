# Serve stops answering generated pages under load

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-31, from the branches `calummoore/mokly-ui-inspector` and `calummoore/mokly-ui-preview`, during the mockup milestones of the shell views plan, which do not change the server.
- **Location:** the watched Serve of `crates/mokly-server`: the render workers (`mokly-render-0` to `mokly-render-5`) and the temporary render of a local edit, whose deadline error is `[mokly/build-invalid] The temporary render exceeded its ten-second deadline.`
- **Reason:** Nobody reproduced the hang on demand, and the stack that found it does not change the server.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Watched Serve:** `mokly serve` with watching, which `npm run dev` starts.
    It renders the catalogue's generated documents under
    `/static/mokly-generated/` on request.
  - **Temporary render:** the render of a sample with the reader's local
    prop edits, which Serve makes in both viewports when a reader changes a
    control in the Props panel.
- **Background:**
  - On 2026-10-31 two agents ran smoke tests through `npm run dev` while
    other builds of the repository used most of the 8 CPUs. The load average
    reached 6 to 7.
  - **Case 1, port 4195:** a script opened
    `/view/design/library/preview/device-frame/phone/`, opened Props, and
    changed the Device control. The log then wrote the deadline error twice,
    once for each viewport, and no further line. The edited frames stayed
    empty. From then on, every request under `/static/mokly-generated/` got
    no answer: one `curl` of
    `/static/mokly-generated/design/library/preview/device-frame/phone/index.mobile.html`
    waited 717 seconds, and three other generated documents gave no answer
    within 30 seconds. The root `/` answered in 1 ms. The hang lasted at
    least 18 minutes, until the server stopped. A restart cleared it, and
    the same edit caused it again once under the same load. Without the
    load, the same edit rendered in 316 ms.
  - **Case 2, port 4193:** about two minutes after the start, the frame of
    `/view/design/browse/views/details-screen/` stopped loading. Then every
    `/static/mokly-generated/` route hung: a document, a bundled stylesheet,
    and an imported image. Shell pages answered in 1 ms. The log showed no
    deadline line. The thread list showed 19 `tokio-rt-worker` threads and
    the six `mokly-render` threads waiting on futexes, and all six sidecars
    idle in `ep_poll`. A restart cleared it.
- **Problem:** Under heavy CPU load, watched Serve can stop answering every
  generated document until it restarts, also after the load ends.
- **Impact if no action:** A reader's development server can freeze during
  a long build or a busy machine, and only a restart brings it back. Nothing
  tells the reader why.
- **Root question:** How does Serve keep answering generated documents after
  a render misses its deadline or a worker stalls?
- **Options:**
  - **A.** Reproduce the hang with a stress test that delays the sidecar past
    the temporary render's deadline, then find the lock or the worker slot
    that the deadline path does not release, and fix it. Effort: Medium.
  - **B.** A, plus a watchdog that reports a render worker that holds its slot
    past a limit, with the route and the elapsed time. Effort: Medium.
- **Left out:** A longer deadline, because it hides the stall. A restart on
  timeout, because it drops the reader's state and hides the cause.
- **Wider fix:** B adds watchdog output that no recorded requirement covers, so
  it needs approval. A can reproduce and fix the existing failure without that
  new diagnostic behaviour.
- **Previous examples:** None found.
- **Recommendation:** A. The two cases point at a release missing on a
  timeout path, and a reproduction names it.
- **Action:** fix after merge, apply A, because the server is outside the
  shell views stack.
