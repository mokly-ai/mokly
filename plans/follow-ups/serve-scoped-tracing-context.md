# Carry the tracing subscriber across Serve thread hops

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** Yes.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from the options check of the render worker tracing
  decision in the parallel comparison plan on branch
  `calummoore/mokly-parallel-view-comparison-n4kr`. The check listed this
  outside the scope.
- **Location:** `crates/mokly-server/src/changes_execution.rs:41-43`,
  `crates/mokly-server/src/changes_execution.rs:75-77`,
  `crates/mokly-server/src/changes_execution.rs:182-184`,
  `crates/mokly-server/src/changes_background.rs:71-77`,
  `crates/mokly-server/src/changes_background.rs:157-159`,
  `crates/mokly-server/src/comparison_requests.rs:69-81`, and
  `crates/mokly-server/src/comparison_requests.rs:121-123`.
- **Reason:** The hops lie outside the parallel comparison change, and the
  production timing output is not affected, so the fix waits for its own
  branch.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Subscriber:** the `tracing` collector of spans and events. Serve's
    timing layer is one, in `crates/mokly-cli/src/serve_trace.rs`.
  - **Dispatch:** the `tracing` handle of one subscriber. Each thread has a
    default dispatch.
  - **Scoped subscriber:** a subscriber that `tracing::subscriber::with_default`
    or `set_default` makes the default dispatch of one thread, for one scope.
  - **Thread hop:** a `tokio::spawn` or `tokio::task::spawn_blocking` call
    that moves work to another thread.
- **Background:**
  - Production installs one global subscriber. `crates/mokly-cli/src/serve_timing.rs:32-33`
    calls `serve_trace::install` when `--debug-timings` is set. That function
    calls `tracing::subscriber::set_global_default` at
    `crates/mokly-cli/src/serve_trace.rs:46`. A global default is the default
    dispatch of every thread.
  - Tests can use scoped subscribers instead. For example,
    `crates/mokly-cli/src/_tests_/serve_trace_tests.rs:87` captures records
    with `tracing::subscriber::with_default`.
  - Seven Serve thread hops carry the caller's span, but not its dispatch:
    - `changes_execution.rs:41-43`, `:75-77`, and `:182-184` call
      `spawn_blocking` with `parent.in_scope(...)`.
    - `changes_background.rs:157-159` does the same for `source.references`.
    - `comparison_requests.rs:121-123` does the same for the selected
      capture.
    - `changes_background.rs:71-77` and `comparison_requests.rs:69-81` call
      `tokio::spawn` with `.instrument(tracing::Span::current())`.
  - In `tracing`, an entered span reports to its own subscriber. A new span
    or event uses the default dispatch of the current thread.
    `tracing::Span::current()` also asks that default dispatch.
  - So after one of these hops, new spans, events, and `record` calls on
    `Span::current()` go to the global default. Under a scoped subscriber of
    the caller's thread, they do not reach that scoped subscriber.
  - The render pool of `mokly-graph` carries both values. `WorkerContext` in
    `crates/mokly-graph/src/worker_context.rs` captures `tracing::Span::current()`
    and `tracing::dispatcher::get_default(Clone::clone)`. It runs each job in
    `tracing::dispatcher::with_default(&dispatch, || parent.in_scope(job))`.
  - A code read shows that the Changes classification runs after a span-only
    hop:
    - `ChangesPass::execute` opens the `changes.classify` span at
      `changes_execution.rs:22`.
    - Its hop at `:41-43` runs `prepare`, which calls `source.classify` at
      `:120`.
    - In the CLI, `Source::classify` at
      `crates/mokly-cli/src/serve_changes.rs:124-129` calls `classify_native`,
      which prepares the base, captures it, and compares the views.
    - `execute` itself runs inside the `tokio::spawn` hop at
      `changes_background.rs:71-77`.
    - The error path at `changes_execution.rs:86` records `status` on
      `tracing::Span::current()` inside a blocking hop.
  - No test or run has checked which spans, events, and status records a
    scoped subscriber loses at these hops. This effect follows from the
    `tracing` rules above. Nobody reproduced it.
  - No production symptom was observed.
- **Problem:** Seven Serve thread hops carry the caller's span but not the
  caller's subscriber. Under a scoped subscriber, the spans, events, and
  status records after a hop can miss that subscriber. A code read shows that
  the Changes classification runs after such a hop.
- **Impact if no action:** A test or an embedding host that captures Serve
  timing with a scoped subscriber can miss the work after these hops. This
  can include the classification and its status record. The production
  timing output stays complete, because the CLI installs a global subscriber.
- **Root question:** How should every Serve thread hop keep its work in the
  caller's subscriber, also when that subscriber is scoped to one thread?
- **Options:**
  - **A.** At each hop, capture the dispatch with the span. Wrap each blocking
    closure in `tracing::dispatcher::with_default`, and each spawned future in
    `tracing::instrument::WithSubscriber::with_current_subscriber`. Cost:
    seven local edits, and a new hop can forget the rule. Effort: Small.
  - **B.** Add one `mokly-server` helper that carries the span and the
    dispatch, as `WorkerContext` does for the render pool. Use it at every hop,
    for blocking closures and for spawned futures. Cost: a small new module,
    and a test with a scoped subscriber that first shows the loss. Effort:
    Medium.
  - **C.** Change nothing, and state that a timing capture needs a global
    subscriber. A test that needs Serve spans then runs in its own test binary
    with a global subscriber. Cost: the limitation stays for embedding hosts
    and for scoped test captures. Effort: Small.
  - **D.** Export the render pool's span-and-dispatch helper from
    `mokly-graph`, which `mokly-server` already depends on. Use it at the seven
    Serve hops. Cost: one more public item in `mokly-graph`, and the same
    scoped test as B. Effort: Medium.
- **Left out:**
  - A global subscriber for each test fails the goal. A process can set its
    global default only once, so parallel tests in one binary cannot each own
    one.
  - Running the hopped work on the caller's thread breaks the rule that
    blocking Serve work stays off the HTTP event loop.
  - A lint that rejects a span-only hop is a new check, so it needs the user,
    and D removes the case without a check.
- **Wider fix:** D. One helper then carries the span and the dispatch at
  every thread boundary of the render pool and of Serve. A new hop in either
  crate uses the same rule.
- **Previous examples:** The `ThreadWorkers` methods in
  `crates/mokly-graph/src/workers.rs` used the same span-only pattern. On
  2026-11-17, the parallel comparison branch added `WorkerContext` to carry
  the dispatch too.
- **Related:** `plans/follow-ups/scoped-tracing-test-captures.md` makes
  scoped captures safe in parallel tests. A stable scoped test for this item
  needs that capture safety. The two problems differ: that item covers the
  callsite interest cache, and this item covers dispatch propagation.
- **Recommendation:** D. One shared helper keeps the span and the subscriber
  together at every thread hop. It adds no public behaviour.
- **Action:** fix after merge, apply D, because the hops are outside the
  parallel comparison change, and the production timing output, which uses a
  global subscriber, is not affected.
