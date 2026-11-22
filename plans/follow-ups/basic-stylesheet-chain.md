# Warm basic start runs 38 stylesheets one at a time

- **Severity:** Medium. **Effort:** Large. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from the branch
  `calummoore/mokly-earlier-postcss-start-bdhv`, at the request of the
  performance orchestrator after the light-sidecar-entry experiment.
- **Location:** `packages/mokly/src/sidecar/postcss-worker.ts`, where each
  reply repeats the configuration's dependencies and read evidence.
  `packages/mokly/src/sidecar/postcss.ts`, `PostcssWorkers.transform`.
  `crates/mokly-render/src/postcss.rs`, where the core sends `processCss`.
  `crates/mokly-render/src/stylesheet_record.rs`, which keeps the context
  evidence of each stylesheet record.
- **Reason:** Each option changes a protocol rule or trades speed against
  memory or evidence risk, and none has a measured prototype yet.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Stylesheet chain:** the `processCss` requests of one warm start, which
    the sidecar of the PostCSS context serves one at a time through one child.
  - **Later batch:** the 35 stylesheets that follow `describe` and `bindings`
    on a warm `examples/basic` start.
  - **Configuration evidence:** the dependencies and read evidence of the
    modules that the PostCSS configuration loads. They are the same for every
    stylesheet of one context.
- **Background:**
  - The split comes from 20 warm `main` restarts of `examples/basic` at
    1a2534d03, with 2 sidecars, on a 4-vCPU machine, on one clock.
  - Each start sends 38 `processCss` requests, from about 382 ms to about
    1,379 ms after the core start. `serve.ready` came at 1,496 ms on the mean.
  - The first request waits about 167 ms for the child. Two more follow. Then
    the core runs `cssModules`, `describe`, and `bindings` for about 160 ms.
  - The later batch starts after `bindings`. The core keeps up to 4
    stylesheet bundles in flight, and their requests reach the sidecar about
    1 ms after each reply. So the sidecar time sets the pace of the batch.
  - The sidecar serves each later request in about 12.3 ms: 1.7 ms to the
    child, 4.3 ms of PostCSS run, 2.0 ms of child work after the run, and
    4.2 ms back to the core.
  - A request is about 2.6 KB, and its reply about 224 KB. Each reply repeats
    the configuration evidence. The core already keeps one copy of the module
    evidence of a context in memory, but the wire carries it in each reply.
  - The child runs PostCSS for about 186 ms of each start, and the sidecar
    spends about 600 ms on all 38 requests.
  - The PostCSS child reached 184 to 194 MiB resident memory during a start.
    A sidecar reached 164 to 168 MiB.
- **Problem:** About two thirds of the sidecar time of a later stylesheet is
  transport and evidence work, not PostCSS. The later batch is serial, so this
  overhead adds up on the path to `serve.ready`.
- **Impact if no action:** About 430 ms of each warm basic start is the later
  batch, and about 280 ms of that is overhead outside the PostCSS runs.
- **Root question:** How does a warm start process its stylesheets with less
  serial overhead, without different output or evidence and within the memory
  budget?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Send the configuration evidence once for each context. The first
    reply of a context carries it, later replies carry only their own
    dependencies and reads, and the core attaches the context evidence to each
    record as it does in memory. Projection: a later request falls from about
    12 ms to about 7 ms, so a warm basic start ends about 150 to 200 ms
    sooner. Memory: lower, about 8 MB less JSON for each start. It changes
    the result rules of the PostCSS page. Effort: Large.
  - **C.** Fewer requests: one request carries several stylesheets of the
    later batch. Projection alone: about 50 to 100 ms less round-trip work.
    With one copy of the configuration evidence for each batch, it reaches
    about the gain of B. Memory: like B. It needs a batch request or result,
    and the core must group stylesheet bundles that run in parallel today.
    Effort: Large.
  - **D.** Concurrency inside the one child: the sidecar sends the next
    request while the child still sends the previous reply. Projection: a
    later request falls toward 6 to 7 ms, so about 150 to 200 ms. Memory:
    about the same. It needs read evidence for each request, because the read
    observers of the child cover the whole process today, and it changes the
    rule that requests on one sidecar run in order. Effort: Large.
  - **E.** A second child during the start: the later batch splits over two
    children of one context. Projection: the batch time halves, minus a
    second configuration load of 150 to 185 ms beside the first, so about 100
    to 200 ms. Memory: about 185 to 195 MiB more while both children live,
    which likely exceeds a 2% bar. It changes the rule of one child for each
    context. Effort: Large.
  - **F.** Keep stylesheet bundles across restarts. Parked, because no
    PostCSS result has complete evidence. See
    [stylesheet-cache-across-restarts.md](./stylesheet-cache-across-restarts.md).
    Effort: Large.
- **Left out:** Skipping PostCSS for a stylesheet that a plugin might not
  change: Mokly treats plugins as opaque, so it cannot know which stylesheets
  a plugin changes.
- **Wider fix:** None. This is a speed opportunity, not a class of defect.
- **Previous examples:** #242 kept one copy of the module evidence of a
  context in the core.
  [postcss-config-inputs-per-record.md](./postcss-config-inputs-per-record.md)
  shares the configuration's local inputs across records in memory.
- **Related:**
  - [light-sidecar-entry.md](./light-sidecar-entry.md) records the closed
    experiment that measured this split.
  - [postcss-request-order-varies.md](./postcss-request-order-varies.md)
    concerns the order of the same requests. Options C and D change it.
- **Recommendation:** B. It removes the largest measured part of a later
  request and lowers memory, without a second child or a new request order.
- **Action:** ask the user, because each option changes a protocol rule, and
  a measured prototype must confirm the projection before a choice.
