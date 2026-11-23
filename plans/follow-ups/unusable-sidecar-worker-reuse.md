# A failed sidecar exchange can reuse its worker

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from the branch
  `calummoore/mokly-earlier-postcss-start-bdhv`, round 2 of its
  implementation review. That branch added tests that pin the current rule for
  the new `prepareContext` request.
- **Location:** `crates/mokly-sidecar/src/pool_requests.rs` (`Pool::execute`,
  `Pool::prepare_context`), `crates/mokly-sidecar/src/pool_bundle_cache.rs`
  (`seed_bundle`), `crates/mokly-sidecar/src/pool_warmup.rs`
  (`maintain_warmup`), and `crates/mokly-sidecar/src/process_worker.rs`.
- **Reason:** The structural fix changes the worker exchange of the whole
  sidecar pool, far outside the branch that found it.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Sidecar pool:** the Rust code in `crates/mokly-sidecar` that owns the Node
    sidecar processes. A slot holds one process and its worker.
  - **Unusable failure:** an exchange error that `reusable` in
    `crates/mokly-sidecar/src/pool_exchange.rs` rejects: a crash, a timeout, or
    a `sidecar-protocol` reply. After it, the order of later replies on that
    pipe is unknown.
  - **Late reply:** the reply to a request whose deadline passed. It can still
    arrive on the pipe later.
- **Background:**
  - The client reads the next response frame and does not compare its id with
    the request id (`crates/mokly-sidecar/src/client.rs`). The pool sends its
    requests with id 1.
  - Several pool steps catch an exchange error and decide what to do: the
    `prepareContext` step of `Pool::execute`, the disk seed in `seed_bundle`,
    and `maintain_warmup`. Each step must return an unusable failure, so that
    `request_call` replaces the process, as the deadline rule of
    `docs/protocol/mokly-sidecar-lifecycle.md` requires ("the binary kills that
    sidecar, retries the request once on a fresh sidecar").
  - On 2026-11-22, a table test pinned this rule for `prepareContext`: a crash
    or a timeout replaces the worker and retries, and a `sidecar-protocol`
    reply fails the call without a retry. A change that ignores such a failure
    in another step is caught only by the tests of that step.
- **Problem:** Nothing in the types stops a step from keeping a worker after an
  unusable failure. A step that ignores the failure lets a late reply answer a
  later request on the same worker.
- **Impact if no action:** A future step that catches every error can corrupt
  later exchanges on one process. For example, after an ignored timeout, the
  late reply answers the next request, and that request then fails with
  `sidecar-protocol` without a retry.
- **Root question:** How does the pool make sure that no request uses a process
  after an exchange left that process unusable, also after later changes?
- **Options:**
  - **A.** Keep the rule by tests for each step that catches an exchange error.
    Effort: Small.
  - **B.** The worker records each unusable failure, and each later request on
    that worker fails at once with `Error::Crashed`, without a send. It is a
    detection fix in `process_worker.rs`. Every current caller already replaces
    the process after such a failure, so no current flow reaches it. Effort:
    Small.
  - **C.** Consume the worker after every unusable failure: the pool steps pass
    the worker by value, and an unusable failure returns no worker. No caller
    can then send to that process again. The `Worker` trait and its test
    mocks stay. Effort: Medium.
- **Left out:**
  - New request ids that the client checks: it adds a stricter validation and
    reverses the transport decision that each side trusts frames of the same
    version (`docs/protocol/mokly-sidecar.md`).
  - Skip a late reply by its id: the pool then keeps a process whose deadline
    passed, against the deadline rule.
- **Wider fix:** C. It is structural, because no step can hold a worker whose
  reply order is unknown. B is the detection fix for the same class.
- **Previous examples:** The `prepareContext` step (2026-11-22). The disk seed
  in `seed_bundle` and `maintain_warmup` also catch exchange errors.
- **Recommendation:** C. It removes the wrong case for every step at a Medium
  cost, without a protocol change.
- **Action:** fix after merge, apply C, because it changes the worker exchange
  of every pool step and its test doubles, outside the branch that found it.
