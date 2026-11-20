# Serve stops answering generated pages under load

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-31, from the branches `calummoore/mokly-ui-inspector` and `calummoore/mokly-ui-preview`, during the mockup milestones of the shell views plan, which do not change the server.
- **Location:** the watched Serve of `crates/mokly-server`: the render workers (`mokly-render-0` to `mokly-render-5`) and the temporary render of a local edit, whose deadline error is `[mokly/build-invalid] The temporary render exceeded its ten-second deadline.`
- **Reason:** Ten stress runs under CPU load at `e5acd1a25` recovered after reply release but did not reproduce the persistent hang or identify its source.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Watched Serve:** `mokly serve` with watching, which `npm run dev` starts.
    It renders the catalogue's generated documents under
    `/static/mokly-generated/` on request.
  - **Temporary render:** the render of a sample with the reader's local
    prop edits, which Serve makes in both viewports when a reader changes a
    control in the Props panel.
  - **Node sidecar:** the Node process that renders JavaScript mockups for
    Mokly.
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
  - On 2026-11-20 the user confirmed option A without a watchdog, a restart
    on timeout, or a longer deadline. The user requested evidence and a
    new decision if the stress test could not reproduce the hang or
    identify its source.
  - Controlled deadline probes ran on 2026-11-20 at
    `e272615f206e31c85bb435fae78c60f93cd178f4`.
    The hang used 2026-10-31 server code. The tested commit includes later
    pool changes and the memory admission and call claims from PR #330.
    PR #330 added `serve_gate.rs` and `pool_claim.rs` on 2026-11-18.
  - `Workers::preview` in `crates/mokly-server/src/work.rs` times out its
    asynchronous waiter after ten seconds. Its blocking render retains the
    page gate and HTTP worker permit until `Documents::preview` returns.
    The existing tests in
    `crates/mokly-server/src/_tests_/work/timeout_tests.rs` require this
    ordering. All three tests passed.
  - A temporary admission probe used real `Workers`, six `ThreadWorkers`
    render threads, `ServePool`, and a memory-admitted sidecar `Pool`.
    Mock worker replies waited on explicit release signals. The probe
    advanced fake time to 9,999 ms, checked that the previews still waited,
    then advanced to 10,000 ms and checked `Rejection::RenderFailed`.
  - With two replies held, four generated requests answered while the
    previews still held their slots. With all six replies held, those
    requests waited until release. After release, all eleven generated
    requests answered in each scenario. These document results were mocked.
  - In the six-delay scenario, a second six-call burst reused all six
    existing pool slots. Both scenarios ended with exactly six process
    spawns. The Serve gate's active, waiting, and foreground counts all
    returned to zero. Mock memory headroom stayed at 7 GiB throughout
    the probe.
  - A separate temporary graph probe used real catalogue preparation,
    `Graph`, `HtmlComposer`, `MemoFragments`, `ThreadWorkers`,
    `GraphDocuments`, `Workers`, CSS compilation, source snapshots, and
    temporary bundle assembly. The source reader, definition provider, and
    fragment renderer were mock boundaries.
  - That probe held edited mobile and desktop fragments past the same
    fake ten-second boundary. A saved page answered while both edited
    fragments remained held. Its logical link also validated a target
    page's anchor.
  - After release, another preview of the same page succeeded with its
    document, stylesheet, and SVG. All six saved document routes, one
    stylesheet, and one imported SVG answered through
    `GraphDocuments::generated` in `crates/mokly-server/src/backend.rs`.
  - Each probe passed ten independent runs on unchanged product code.
    They used no retry, sleep-based wait, elapsed-time assertion, or longer
    deadline. The initial test body times were 0.04 seconds for admission
    and 0.08 seconds for the graph. These times were reports, not assertions.
  - The inspected admission owners are
    `crates/mokly-cli/src/serve_gate.rs`,
    `crates/mokly-cli/src/serve_pool.rs`,
    `crates/mokly-sidecar/src/pool_exchange.rs`, and
    `crates/mokly-sidecar/src/pool_claim.rs`.
    No leaked claim, slot, or gate was found in these probes.
  - These controlled probes did not run a real Node process, a watched
    source edit, the HTTP opaque-asset spool path, or CPU load. The mock
    workers ignored the sidecar call deadline, so replacement was not
    exercised. Every held reply was released. These probes cannot detect
    a job that never returns or establish that the historical hang is fixed.
  - The diagnostic modules were removed. No product fix or permanent
    regression test was added, because no assertion exposed a product defect.
  - A real Node stress probe then ran ten independent times at
    `e5acd1a25355139eeaa4559b3fed0ade35afabee`, after PR #385 merged.
    Each run started a fresh watched Serve on the example catalogue.
    The pool bound was six sidecars. This machine had four CPUs, compared
    with eight in the historical report.
  - A context-only copy of the built sidecar entry kept the real `Session`,
    render functions, framing, transport, and deadlines. An explicit socket
    gate withheld completed Phone render replies before their normal write.
    It matched the Browser Device edit and a unique Address marker.
  - Four separate Node processes generated CPU load after catalogue setup.
    They reported readiness through IPC. All forty recorded CPU counters
    increased. The load stayed active through the recovery checks.
  - Both edited viewport replies reached the gate before their HTTP
    failures in every run. Each viewport returned HTTP 422 with
    `render-failed`, and Serve logged its existing ten-second deadline.
    All twenty held sidecar records showed state `S` and wait channel
    `ep_poll`.
  - The saved Phone HTML and a generated stylesheet answered HTTP 200
    while both replies remained held. After explicit release, each run
    read all 590 declared generated documents and their reachable generated
    resources: 37 stylesheets and one image. All 6,280 responses returned
    HTTP 200 with nonempty bodies. These requests used the real HTTP
    resource paths, including opaque image delivery.
  - Another preview of the same page returned HTTP 200 and its edited
    HTML in every run. There were no late gate arrivals, retries,
    sleep-based waits, assertions about elapsed wall clock time, or cleanup
    failures.
    The product deadline stayed ten seconds. Setup used the existing
    catalogue allowance, and the active test retained its 60-second guard.
  - The first successful runner reported 56.40 seconds, including setup.
    Its preview-deadline diagnostic was 10,031.9 ms, and recovery took
    5,964.5 ms. These values were reports, not pass conditions.
  - Two draft attempts failed before a stress body ran. The gate first
    used an environment prefix that Mokly strips. The next draft used the
    document-only route reader to find a stylesheet. Both harness errors
    were corrected before the ten successful runs.
  - This stress probe used the standard missing-base fixture, so base
    comparisons did not run. CPU load started after catalogue preparation.
    No source watch edit, startup under load, historical build, or debugger
    attachment ran. Replies were released before the sidecar method's own
    timeout. No process replacement or job that never returns was tested.
    Dynamic default growth and deliberate memory pressure were not exercised.
  - The persistent hang and its source remain unknown. The retained item
    records the requested fallback. Diagnostic sources stay outside the
    gate because they passed on unchanged product code.
- **Problem:** Under heavy CPU load, watched Serve can stop answering every
  generated document until it restarts, also after the load ends.
- **Impact if no action:** A reader's development server can freeze during
  a long build or a busy machine, and only a restart brings it back. Nothing
  tells the reader why.
- **Root question:** How does watched Serve keep answering generated
  documents when render work stalls under heavy load?
- **Options:**
  - **A.** Reproduce the hang with a stress test that delays the sidecar past
    the temporary render's deadline, then find the lock or the worker slot
    that the deadline path does not release, and fix it. Use real Node
    sidecars and the original pages under CPU load. Capture blocked stacks
    if requests remain stuck after delayed replies finish. Effort: Medium.
  - **B.** A, plus a watchdog that reports a render worker that holds its slot
    past a limit, with the route and the elapsed time. Effort: Medium.
  - **C.** Capture the blocked thread stacks when the live hang next occurs,
    then resume A with that evidence. Keep this item open in the meantime.
    This avoids a speculative fix but leaves the historical failure
    unresolved. Before a Linux reproduction, install `gdb` and build with
    `CARGO_PROFILE_DEV_DEBUG=2 npm run build`.
    Use the native `mokly` process that owns the hung port. During the hang, run
    `sudo gdb -p {pid} -batch -ex "thread apply all bt"`.
    Keep the Serve log, stuck route, and commit with the stacks.
    Asynchronous semaphore waits can need additional state. Effort: Medium.
  - **D.** Run the load reproduction on the 2026-10-31 server code first,
    then on `main`. Start with commit
    `8c2bbff2c146a2f77f469668e342da127e3e0397`.
    If only that code hangs, bisect to identify the change that removed
    the hang. If `main` hangs, capture blocked stacks and continue A.
    A rare reproduction can make the bisect cost Large. Effort: Medium.
  - **E.** Audit waits while jobs hold HTTP worker permits, including
    generated, asset, and authored routes without a deadline. Probe each
    suspect wait with explicit signals and fake time. Fix a demonstrated
    fault and retain its regression test. The audit can find no cause.
    Effort: Medium.
  - **F.** Redesign blocked work so it can stop at every wait and return
    its worker permit. Add typed failures for stopped work. This changes
    the failure behavior of generated routes and needs approval. It reaches
    the server, graph, sidecar, and their protocol docs. Effort: Large.
- **Left out:** A longer deadline, because it hides the stall. A restart on
  timeout, because it drops the reader's state and hides the cause.
  Closing this item as fixed is unsupported by the negative probes.
  Releasing only the HTTP permit at the deadline leaves the blocked render
  running and removes the tested bound on blocking work. A generated-request
  deadline alone also leaves its blocking job holding its permit.
- **Wider fix:** F replaces indefinite waits with work that can stop, but
  adds new failures and needs approval. Its design is not established by
  these probes. B reports stalls without releasing blocked work and also
  needs approval.
- **Previous examples:** None found.
- **Recommendation:** D. Compare the code that hung with current code.
  Another pass on current code cannot show whether a prior change already
  removed the hang. This replaces the initial recommendation of C after
  the independent options check.
- **Action:** ask the user, because the stress runs with real Node sidecars
  did not reproduce the persistent hang, and the user requested a decision.
