# Serve stops answering generated pages under load

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-31, from the branches `calummoore/mokly-ui-inspector` and `calummoore/mokly-ui-preview`, during the mockup milestones of the shell views plan, which do not change the server.
- **Location:** the watched Serve of `crates/mokly-server`: the render workers (`mokly-render-0` to `mokly-render-5`) and the temporary render of a local edit, whose deadline error is `[mokly/build-invalid] The temporary render exceeded its ten-second deadline.`
- **Reason:** No bounded run or audit reproduced the hang or named its source, so the next step needs blocked stacks from a live hang.

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
  - On 2026-11-20 the follow-up orchestrator, the agent session that
    assigned this investigation, answered the rule to bring a negative
    result to the user. It said that the rule was its own prompt rule. It
    authorized investigation only, with no change to behaviour, a gate, or a
    requirement. B and F stayed with the user.
  - It authorized D first, with at most 20 started Serve attempts on each
    commit. If only the historical code hung, D would bisect. If main hung,
    D would capture `gdb` stacks and fix the demonstrated fault.
  - If neither commit hung, E followed, with a fix only for a demonstrated
    fault. If D and E both found nothing, the work stopped. The item then
    records the run counts, the computer, the commits, and the audit list,
    and its Action keeps C.
  - D ran on 2026-11-20 on one Linux computer with four CPUs and 7.75 GiB
    RAM. It had Ubuntu 24.04.4 LTS, Linux `6.8.0-117-generic`, Node
    `v24.22.1`, npm `11.21.0`, and Google Chrome `151.0.7922.108`. E later
    ran on the same computer.
  - D compared the historical commit
    `8c2bbff2c146a2f77f469668e342da127e3e0397` with
    `e7f1468abe4a31187fd1dc46741ef5449e1e2790`, the main commit when D
    started. Each commit had its own worktree, `npm ci`, and declared Rust
    toolchain: 1.95.0 for the historical commit and 1.98.1 for main.
  - Each commit had a debug build with DWARF symbols:
    `CARGO_BUILD_JOBS=2 CARGO_PROFILE_DEV_DEBUG=1 CARGO_PROFILE_DEV_STRIP=none npm run build`.
    D added no response gate, delay, shorter deadline, or product edit.
    Each commit was its own comparison base, so the real base comparison
    ran.
  - Each attempt used a new Serve process and a new headed Chrome browser.
    Six Node CPU load processes reported readiness through IPC before Serve
    started. They ran until the route checks ended, and each valid run
    recorded six CPU counter increases.
  - The browser opened `/view/design/browse/views/details-screen/` with
    both viewports directly after the listening line. Then it opened
    `/view/design/library/preview/device-frame/phone/`, opened Props, and
    selected Browser in the Device control.
  - Attempts 2 to 20 on both commits made this edit while the comparison
    was pending. These are 19 matched pairs. Attempt 1 on each commit waited
    for the comparison before the edit. Each attempt then read every indexed
    generated document and each generated stylesheet and image that they
    reach.

    | Commit                 | Started | Valid | Generated reads | Device outcomes |
    | ---------------------- | ------: | ----: | --------------: | --------------: |
    | Historical `8c2bbff2c` |      20 |    19 |          11,932 |              38 |
    | Main `e7f1468ab`       |      20 |    20 |          12,560 |              40 |

  - Each valid run read 590 documents, 37 stylesheets, and one image. All
    24,492 reads returned HTTP 200 with a nonempty body. All 78 accepted
    Device outcomes returned HTTP 200 and showed the Browser address. No
    run had a deadline diagnostic, an HTTP 422 response, or a hang.
  - Valid historical runs had 194 POST responses with HTTP 200 and 12 with
    HTTP 409, from the viewer's own revision refresh. Main runs had 192
    with HTTP 200. The harness added no retry. The 600-second setup guard
    and the 60-second phase guards stayed unchanged.
  - Historical attempt 1 was a harness failure and was not replaced. The
    Device control uses option indices, so the harness waited for `phone`
    but saw `0`. It sent no POST, and its 60-second guard stopped it.
    During its capture, `/` and a generated Details document returned HTTP
    200, and `gdb` stacks showed idle render workers. The corrected harness
    selects Browser by its visible label.
  - Each valid run had four render threads, `mokly-render-0` to
    `mokly-render-3`, against six on eight CPUs on 2026-10-31. The sidecar
    bound was six. Snapshots showed five sidecars, with two PostCSS child
    processes on the historical commit and one on main.
  - The one-minute load average at edit start was 8.14 to 17.30 on the
    historical commit and 12.70 to 16.43 on main, against 6 to 7 on
    2026-10-31. Caches stayed warm, so load and caches were not identical.
  - Three harness checks failed and were corrected without a Serve attempt:
    a `RENDERS_PATH` import from the wrong package, a `tsc` TS5112 error,
    and a Prettier check. Both source trees stayed clean. Every shutdown
    returned code 0, and cleanup found none of 622 and 543 owned processes
    alive.
  - No natural deadline occurred, so D does not show recovery after one.
    Bounded runs cannot rule out a rare hang or a condition of the original
    computer. The historical code did not hang, so no bisect was warranted.
  - E ran on 2026-11-20 on main `477767fc8621681560f01ba3c8f326cf59be9573`,
    merged into this branch as `a5a2b6a461a65f0857811f44209c13a92c523781`.
    This main is newer than the main commit of D. E used no CPU load.
  - E made one finite pass over each wait that a request can reach while
    it holds an HTTP worker permit. It covered temporary renders, generated
    documents and resources, opaque assets, and authored files, also the
    routes without a deadline. It compared each changed owner with the
    historical commit.
  - The table below is E's accepted wait map of 35 owners. A route has no
    new deadline in it. A collaborator that never returns is an external
    progress limit, not a missing release by itself. A file name without a
    folder is in the folder of the path before it. The last column starts
    with the suspect class:
    1. `Workers` permits, page gates, and priority.
    2. Graph documents, fragments, and anchor flights on the render threads.
    3. Source snapshot reads, digests, and metadata locks.
    4. PostCSS turns, the CSS cache, and module flights.
    5. Opaque asset capture, spool IO, and authored opens.
    6. Sidecar call admission, pool slots, claims, start, and cleanup, and
       process timeout, replacement, and cancellation.
    7. Render store activity, index, stripes, and pending offers.

    | Owner and function                                                                                     | Requests                                                      | Resources held at this wait                                      | Bound or wake-up evidence                                                                                                                                                                                                                 | Suspect class / limit                                                                                                             |
    | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
    | `crates/mokly-server/src/work.rs`: preview page and worker semaphores                                  | Preview                                                       | Queue ticket, priority, activity; page gate before worker permit | The page gate is acquired before the HTTP worker. The 10 s timeout or changed notification drops queued acquisition. Started work owns the acquired gates.                                                                                | 1. No HTTP permit is held while waiting for the page gate.                                                                        |
    | `crates/mokly-server/src/work_delivery.rs`, `work.rs`: HTTP admission                                  | Generated, opaque, authored, preview                          | Priority, activity, snapshot; preview may hold page gate         | Fair semaphore; RAII return by earlier native job. Stop closes admission by flag and waits for all permits.                                                                                                                               | 1. Before the permit, but included for lifetime context.                                                                          |
    | `crates/mokly-server/src/work_delivery.rs`, `work.rs`: `spawn_blocking` queue and join                 | All four                                                      | HTTP permit, priority, activity; preview page gate               | Closure owns every permit. Join reports success/error/panic; dropping the async request does not drop running native work. Preview waiter has the original 10 s timeout.                                                                  | 1. Tokio scheduler progress is assumed. No deadline on the other three routes.                                                    |
    | `crates/mokly-server/src/backend.rs`: per-route usage/render mutex                                     | Generated document; background can own it first               | HTTP permit and optionally native render thread                  | Guard releases on success, typed error, or unwind. Calls generation render; no recursive call to `GraphDocuments::render`.                                                                                                                | 2. Wait depends on the actual render ending.                                                                                      |
    | `crates/mokly-graph/src/workers.rs`: `ThreadWorkers::document` and `closure` `install`                 | Generated document, preview                                   | HTTP permit; caller waits for Rayon completion                   | On-demand inner jobs call `artifact`/`closure_job`, not another scheduled document. Target validation calls `Session::raw` directly on the worker. Temporary composition and closure run sequentially.                                    | 2. Other active pool jobs must finish; active consumer calls use sidecar deadlines.                                               |
    | `crates/mokly-graph/src/fragments.rs`: `MemoFragments::render` flight                                  | Generated document, preview, target anchor composition        | HTTP permit, Rayon worker; document or anchor lock               | Registry map lock ends before per-key lock. The flight guard and registration release on every return/unwind. Renderer request is a sidecar call.                                                                                         | 2. A stuck renderer still keeps its real owner.                                                                                   |
    | `crates/mokly-graph/src/validation.rs`: target anchor flight                                           | Documents and previews with logical fragment links            | HTTP permit, Rayon worker                                        | The target `raw` does composition only. It does not recursively validate target links or take another anchor flight. Guard and request registration release on every return/unwind.                                                       | 2. No anchor-lock cycle found.                                                                                                    |
    | `crates/mokly-graph/src/cache.rs`, `cache_state.rs`, `cache_transit.rs`: cache metadata                | Generated resources/documents, preview                        | HTTP permit, possibly fragment/anchor lock                       | Mutex scopes cover cache bookkeeping. Compaction and restore run outside the state lock. RAII `Transit` releases encoder slot and reservation after failure.                                                                              | 2. CPU/allocator progress; no condition-variable wait.                                                                            |
    | `crates/mokly-graph/src/cache_encoder_pool.rs`, `cache_encoding.rs`: encoder admission/workspace       | Cache insertion from generated/preview; writer in parallel    | HTTP permit while encoding an eviction                           | Encoder lease take is nonblocking. Each leased encoder has one owner. Workspace mutex cannot be taken by another owner of that lease.                                                                                                     | 2. Finite codec work; no wait for a free lease.                                                                                   |
    | `crates/mokly-graph/src/source_snapshot.rs`: read and digest cells                                     | Generated CSS/closure/asset metadata, previews                | HTTP permit; may hold graph/stylesheet lock                      | Read/digest map locks only find cells. Cells release on return/error/unwind. Digest may take its path read cell; read path does not take digest cell.                                                                                     | 3. Source IO has no guaranteed wall-clock bound.                                                                                  |
    | `crates/mokly-graph/src/source_snapshot.rs`: project and directory metadata maps                       | Same                                                          | HTTP permit; one map mutex                                       | Source projection/listing runs while the map lock is held. Real source reader does not call back into the same snapshot. Guard releases on every exit.                                                                                    | 3. A stalled filesystem can block other paths of that map. This is external IO progress.                                          |
    | `crates/mokly-render/src/stylesheet_cache.rs`: local/shared/head/context/check/replay locks            | Evicted generated CSS, document resource closure, previews    | HTTP permit, maybe Rayon worker                                  | Candidate snapshots leave store lock before stamps. Context/replay guards can span source observation. No path re-enters these stores from the source reader.                                                                             | 3/4. Source observation must finish; no timer invented.                                                                           |
    | `crates/mokly-render/src/postcss_turns.rs`, `postcss.rs`: one context turn                             | Evicted generated CSS or closure                              | HTTP permit, optional Rayon thread                               | RAII turn mutex is outside CSS cache. Cached reads do not wait for the turn. Request carries sidecar deadline; typed failures recorded for queued inputs.                                                                                 | 4. One context's request must end.                                                                                                |
    | `crates/mokly-render/src/postcss.rs`: shared CSS cache and inventory                                   | Same                                                          | HTTP permit                                                      | Pool request ends before cache lock. Inventory holds cache while reading source; module flights run after cache lock ends. Context destruction queues release without taking this cache.                                                  | 4. Source IO assumption.                                                                                                          |
    | `crates/mokly-render/src/postcss_read_inventory.rs`: module flight                                     | Same                                                          | HTTP permit                                                      | Owner computes outside registry and cell locks. `ModuleOwner::drop` publishes failure and notifies all on return/error/unwind. Waiters inspect `Ready` or `Failed`.                                                                       | 4. Source project/digest must return or unwind.                                                                                   |
    | `crates/mokly-server/src/backend_assets.rs`: capture `OnceLock`                                        | Opaque asset                                                  | HTTP permit, capture reservation                                 | Reservation exists before worker admission. First admitted initializer captures. Typed error is a retained result; all waiters share it. Last request/response drops the weak route entry's owner.                                        | 5. Initializer may be blocked by external asset/spool IO.                                                                         |
    | `crates/mokly-server/src/asset_streams.rs`, `crates/mokly-graph/src/asset_delivery.rs`: verified spool | Opaque asset; preview asset copies have a separate size bound | HTTP permit, capture initializer                                 | Bounded source length and digest verification. Temporary file IO and source stream operations have no code-owned wake guarantee. Error unwinds before HTTP headers.                                                                       | 5. Filesystem and reader progress explicitly external.                                                                            |
    | `crates/mokly-server/src/public_read.rs`: confinement and open                                         | Authored; preview resource copy                               | HTTP permit                                                      | Policy checks and directory-relative no-follow opens. Native closure ends before response streaming. Regular-file check occurs after open.                                                                                                | 5. OS opens/metadata/reads can block; not a release defect without further evidence.                                              |
    | `crates/mokly-cli/src/serve_gate.rs`: call admission condvar                                           | JS fragment and PostCSS, also prerequisites after replacement | HTTP permit; Rayon thread/flight/turn as applicable              | Foreground head calls never wait for the whole foreground counter. Base calls wait for foreground. CallLease drops claim before ActiveGuard notifies. Close/cancellation notify all. Background calls wait only behind queued HTTP calls. | 6. Existing admitted calls and maintenance must end.                                                                              |
    | `crates/mokly-sidecar/src/pool_admission.rs`, `pool_claim.rs`: capacity and memory                     | Same                                                          | HTTP permit, gate waiter or admitted claim                       | Capacity retains existing reservations and at least one initial slot. Held claim reserves growth even if memory falls. Claim drop removes its entry and notifies pool. No memory-only zero-capacity state.                                | 6. Host/process memory reads are OS IO.                                                                                           |
    | `crates/mokly-sidecar/src/pool_leases.rs`: slot FIFO/affinity condvar                                  | Same                                                          | HTTP permit, admitted call claim, active gate owner              | Release, start rollback, context release, root-affinity change, and stop notify the shared condvar. First runnable ticket can take a slot. Retired affine context fails typed.                                                            | 6. Previous slot owner must finish.                                                                                               |
    | `crates/mokly-sidecar/src/pool.rs`, `pool_start.rs`: lazy start and replacement                        | Same                                                          | HTTP permit, claim, leased slot                                  | Factory creation before hello; StartLease rolls back only not-started allocation, preserving a committed reservation. Factory success installs concurrent control before bounded handshake.                                               | 6. Process creation and host setup are external progress assumptions before hello's deadline.                                     |
    | `crates/mokly-sidecar/src/process_parent.rs`: launch queue and response                                | Same on lazy start                                            | HTTP permit, slot                                                | Durable parent thread runs one OS spawn per queued launch. Channel close fails, rather than losing the result. No timer surrounds `Command::spawn`.                                                                                       | 6. OS spawn and launcher scheduling are external progress.                                                                        |
    | `crates/mokly-sidecar/src/process_transport.rs`: outgoing bounded channel                              | Same including hello/cleanup                                  | HTTP permit, exclusive Worker session, slot                      | Channel capacity 2. Normal client sends one call then receives its result before another. A valid response proves prior frame consumption. Concurrent control uses `try_send`, then kill on a full queue.                                 | 6. Writer can block in OS write, but one current method is already in deadline-governed receive. No normal three-send fill found. |
    | `crates/mokly-sidecar/src/process_worker.rs`, `process_clock.rs`, `client.rs`: frame receive           | Same                                                          | HTTP permit, claim, slot, flight/turn                            | One absolute monotonic deadline is installed before client request. Events do not reset it. Hello 30 s; bundle/describe 120 s; processCss 60 s; other methods 30 s. Existing override unchanged.                                          | 6. Probe real timeout/replacement, not just a mock Worker.                                                                        |
    | `crates/mokly-sidecar/src/pool_preparation.rs`, `pool_cleanup.rs`: prerequisite/cleanup RPCs           | Same when a worker lacks generation state or has stale state  | HTTP permit, claim, slot                                         | Each finite retained prerequisite/dispose call has its own unchanged method deadline; cleanup checks stopped first. A final release enqueues cleanup and does not wait in graph destructor.                                               | 6. No request-wide timer across all prerequisites.                                                                                |
    | `crates/mokly-sidecar/src/pool_exchange.rs`, `pool.rs`: retry and release                              | Same                                                          | HTTP permit, claim, slot                                         | Timeout/crash kills unusable process and retries once. Final release publishes slot and notifies. No unbounded retry loop. Recycle may run before release.                                                                                | 6. Kill is an OS operation; cancellation changes final result to Cancelled.                                                       |
    | `crates/mokly-sidecar/src/pool_recycle.rs`, `process_control.rs`: recycle/stop/exit/stderr             | Same after a method, or concurrent cancel                     | HTTP permit until final slot release                             | Shutdown enqueue is nonblocking. Shared 2 s exit/drain deadline; survivor killed. Post-kill reaping has no second grace timer. Receiver mutex serializes finish callers.                                                                  | 6. Successful OS kill/reap is an external progress assumption.                                                                    |
    | `packages/mokly/src/sidecar/session.ts`, `postcss.ts`: JS method and child work                        | JS/PostCSS routes                                             | Native caller owns permit/slot                                   | Rust deadline covers the Node method, its esbuild/evaluation/render callback, PostCSS IPC, and method response. Consumer code may never return; existing process termination is the boundary.                                             | 6. Unsupported consumer progress is not assumed to have an internal wake.                                                         |
    | `crates/mokly-compare/src/render_admission.rs`: writer activity enter/drop                             | All four; pool request/activity too                           | HTTP permit for nested calls, or acquired before it              | Only a short busy/epoch mutex. `enter` never waits for a writer. Writer readiness is queried outside admission lock. Condvar waits occur on writer only.                                                                                  | 7. Writer wait is not an HTTP wait.                                                                                               |
    | `crates/mokly-compare/src/render_image.rs`, `render_store_read.rs`: identity and index                 | Stored generated documents/anchor compositions                | HTTP permit, Rayon thread                                        | Identity uses `OnceLock::get`, not initialization wait. Index uses `try_lock`; contention is miss. Stored faults queue has a short mutex; no IO inside.                                                                                   | 7. No index/init wait introduced into render.                                                                                     |
    | `crates/mokly-compare/src/render_disk.rs`, `bundle_cache_read.rs`: persistent stripe/state locks       | Same                                                          | HTTP permit, optional acquired shared stripe                     | All bundle_lock calls attempt once and return contention. Raw read does not wait for an exclusive writer. IO/decoding follows successful lease.                                                                                           | 7. Cache filesystem IO and finite decoding have no request-wide timer.                                                            |
    | `crates/mokly-compare/src/render_writer.rs`, `render_pending.rs`: load stats and offer                 | Fresh/stored documents                                        | HTTP permit, Rayon thread                                        | Offer pending set uses `try_lock`; full/contended drops. Load stats locks pending briefly. Pending worker drain releases lock before encode/save. No join in graph read/offer path.                                                       | 7. Observer diagnostics are external writes; production callbacks do not re-enter writer.                                         |
    | `crates/mokly-cli/src/serve_watch.rs`: resource observer                                               | Document/preview closure                                      | HTTP permit, render worker                                       | Graph releases observed/observer locks before callback. Watch observe adds path under short state mutex and signals. Watch adoption takes observer/watch-files locks; no callback retains those locks while waiting for state.            | 3. Native watcher replace/close, source checks outside relevant state scopes where reachable, need OS progress.                   |
    | Diagnostics, cache/resource/closure/reference indexes                                                  | All four                                                      | HTTP permit, relevant higher owner                               | Ordinary scoped mutexes over in-memory records; no nested collaborator wait except warning/terminal reporter or source projection described above. No reverse lock acquisition was found.                                                 | External stderr/terminal pipe can stop writes; not a timer/release claim.                                                         |

  - The wait map found these waits not reachable while a request holds a
    permit: HTTP body collection and validation, the server-sent event
    keepalive, comparison capture admission, which has its own semaphore,
    Git and base preparation gates, and watch debounce, rebuild, and
    candidate queues. It also found the `comparison_stream` result channel
    and join, the writer idle wait and shutdown join, server accept and
    backoff, and response body streaming after an open or a capture not
    reachable.
  - E ran 50 probe cases: 47 existing owner tests, the earlier graph probe,
    and two new real Node probes. Each case ran once and then ten more
    times, each in a new test process. All 550 cases passed, and none failed
    or was ignored.
  - The probes used explicit ready and release signals, fake time, and
    typed results. No probe slept, retried, raised a limit, or asserted
    elapsed time. A 60-second process guard only stopped a hung probe.
  - The real Node probes called `Work::generated`, the native call of the
    generated route. It went through `ServePool`, `Pool`, `NodeFactory`,
    `ProcessWorker`, `Client`, and `PipeTransport` to the real `processCss`.
    A copy of the built sidecar entry held each completed reply before its
    normal write. The pool had one slot, its default deadlines, and its one
    retry.
  - In the timeout probe, a held call kept the HTTP permit and a pool claim,
    and a generated request waited behind it. The call was still pending at
    fake 59,999 ms. At 60,000 ms the pool killed the worker and retried
    once. At 120,000 ms the result was `Error::RequestTimeout` for
    `ProcessCss` with `deadline_ms: 60000`.
  - The waiting request then succeeded through a third worker. The gate
    counts and claims returned to zero, `Work::stop` drained the permit, and
    each process was reaped. In the cancellation probe,
    `ScheduledPool::cancel_requests` gave a typed `Cancelled`, with no retry.
  - The eleven runs of each probe gave 44 sidecar starts, 33 held replies,
    22 method deadlines, 11 final timeouts, 11 later successes, and 11
    cancellations. A check of 84 recorded sidecar process groups found none
    alive.
  - A source review found that the first fake clock extended the hello
    fallback to 60 seconds and ignored the shared exit and drain deadline.
    Its 20 passing checks were excluded. The corrected clock keeps each
    passed absolute deadline and the shared shutdown bound.
  - These probes used no TCP server and forced only the `processCss`
    deadline. Other method bounds, prerequisite replay, and the exit and
    drain bounds rely on owner tests and source review. The probes do not
    identify the original Phone or Details hang.
  - The earlier graph probe passed again with the same mock boundaries. The
    owner tests cover release on failure and unwind, claims after memory
    falls, start rollback, queued cancellation, affine retirement, cleanup,
    prerequisite deadlines, and the render store's nonblocking paths. No
    code cycle or missing wake-up was demonstrated.
  - The Serve gate and the opaque capture changed after the historical
    commit, and the render store is new. The comparison found no concrete
    old defect. So no probe fails on old code and passes on current code,
    and E names no fix.
  - Harness errors were not product failures: compile errors E0502, E0432,
    and E0277, type check errors TS2591 and TS7006, a deliberate driver
    stop with exit 137 for the clock fix, and a build log without its exit
    status. Each was resolved, and a repeat build exited 0.
  - Final checks passed: `npm run build`, `cargo fmt --all -- --check`,
    `cargo clippy -p mokly-cli -p mokly-graph --lib --bin mokly --tests -- -D warnings`,
    and strict type and ESLint checks of the helper scripts. All 386
    sidecar build files matched the probed files. E did not run the
    complete gate.
  - The temporary test registrations in `crates/mokly-cli/src/serve_pool.rs`
    were removed. That file and all 47 audited source files kept their
    original hashes.
  - The audit separates a release that the code guarantees from progress
    that it assumes. It assumes progress from source, spool, and cache IO,
    process creation, kill, and reap, the scheduler, an unread stderr pipe,
    and terminal writes. A collaborator that never returns does not, alone,
    show a missing release.
  - E added no deadline to a route without one. It returned no HTTP permit
    while native work stayed blocked.
  - Neither D nor E shows that the hang is fixed, and neither names a
    commit that fixed it. The render store is new after the historical
    commit, so its audit cannot explain the historical hang.
  - D and E both found nothing, so the work stopped, as the follow-up
    orchestrator required. No diagnostic source or permanent test was
    committed, because no assertion showed a product defect.
  - `gdb` 15.1 was installed on the investigation computer on 2026-11-20.
    Another computer needs it first. The capture of historical attempt 1
    named each native thread of a debug build, such as `mokly-render-0`.
- **Problem:** Under heavy CPU load, watched Serve can stop answering every
  generated document until it restarts, also after the load ends.
- **Impact if no action:** A reader's development server can freeze during
  a long build or a busy machine, and only a restart brings it back. Nothing
  tells the reader why.
- **Root question:** How does watched Serve keep answering generated
  documents, or recover by itself, when render work stalls under heavy load?
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
- **Recommendation:** C. Bounded D and E runs found no hang, fault, or
  source, so stacks from a live hang are the next evidence for A. This
  replaces the recommendation D, which compared the code that hung with
  current code. D had replaced an initial recommendation of C after the
  independent options check. Another pass on current code could not show
  whether a prior change already removed the hang. F best protects the
  codebase, but it changes failure behaviour and stays with the user.
- **Action:** fix after merge, apply C, because the follow-up orchestrator
  chose C on 2026-11-20 for a negative D and E, and both were negative.
