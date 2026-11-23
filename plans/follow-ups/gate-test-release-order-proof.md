# Gate tests can miss an early release

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Owner:** Cal (@calummoore).
- **Added:** 2026-11-21, from the review of the branch
  `calummoore/mokly-eager-base-preparation-5dkn`, draft pull request #461.
  It is the shared wider fix that the independent checks of review findings
  1 and 2 proposed.
- **Location:** The shared skills repository `Firna-AI/skills`, checked at
  commit `14c2aebb5`: `skills/testing/SKILL.md:68` to line 80, and
  `skills/testing/references/deterministic-tests.md:19` to line 40.
- **Reason:** The fix changes the shared `testing` skill in another
  repository, and only the owner can approve that change for a later branch.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Gate:** Code that holds work until a signal opens it, such as a
    condition-variable wait or an admission rule. That signal is the release.
  - **Closed-state observation:** A recorded event that shows that the held
    work had not passed the gate before the release.
  - **Shared skills repository:** `Firna-AI/skills`, which holds the agent
    skills that `AGENTS.md` tells agents to read, such as `testing`.
  - **Break on purpose:** The step of the `testing` skill that changes the
    code under test to a wrong form, to see the test fail.
- **Background:**
  - The `testing` skill in force says: "break the code on purpose: revert the
    change, flip the condition, or return a default." It also says: "The
    failure must come from an assertion about the behaviour."
  - Its deterministic-tests reference lists evidence methods with no timer.
    Event order asserts that a fast response settles while a slow job is
    still pending. Fake clocks assert that a request is still pending just
    before a timeout boundary.
  - No rule or method names a gate that a signal, not a clock, releases. The
    listed breaks revert a change, flip a condition, or return a default. A
    gate test can survive them and never observe the gate closed.
  - The contract of eager base preparation,
    `docs/protocol/mokly-eager-base-preparation.md`, has two such gates. Cold
    base discovery waits for the first readiness of Serve when no complete
    extraction lease exists. At a sidecar capacity of two or three, an eager
    call waits until the usage pass has started its last view.
  - Current state: the `testing` skill stays in force as it is. No skills edit
    is approved. The runtime of the branch and its direct test fixes continue
    without this item.
- **Problem:** Four examples in this repository could pass without the behaviour
  that their names or their requirements state. Two of them test gates, and
  they checked only the state after the release. No shared rule tells an
  author to open a gate at once as the break. No rule tells the author to
  record the closed state before the release.
- **Impact if no action:** New gate tests can repeat the gap. A later change
  can then open a gate early, and no test fails. The direct fixes protect only
  the two tests that the review found.
- **Root question:** How does an author prove that a test of a gate fails when
  the gate opens too early?
- **Options:**
  - **A.** After this merge, add focused guidance to the shared `testing`
    skill. Use a separate branch of the shared skills repository, with the
    approval of the owner.
    - In "Prove that each test can fail" of `skills/testing/SKILL.md`, add a
      break for a wait or a gate. The break makes it open at once but keeps
      its check. The test must then fail on an assertion about the behaviour.
    - In the evidence methods of
      `skills/testing/references/deterministic-tests.md`: a release-order
      method. The test records an ordered event that shows the closed state
      before the release. Then it releases the gate and observes the
      completion. It uses no timer.
    - It changes shared agent rules for every repository that uses them. It
      prevents the class only when agents follow it. Effort: Small.
  - **B.** Keep the general guidance in force, and rely on the direct
    regression tests of the two found tests. This adds no work. A new gate
    test can repeat the gap. Effort: Small.
  - **C.** With the approval of the owner, add a shared mutation-testing gate,
    such as `cargo-mutants` on the changed lines. It adds a gate, its run time,
    and the triage of each surviving mutation. It is not recommended, for the
    reasons under **Wider fix**. Effort: Large.
- **Left out:**
  - A lint for gate tests fails the goal. No lint can tell whether a test
    observes the closed state. A new lint also needs the user.
  - One shared test harness for every gate fails the goal. The two gates work
    in different ways, so no one harness covers both.
  - A rule in the `AGENTS.md` of this repository. The class is not specific to
    this repository, so the rule would split the testing rules across two
    homes. A is better on every point.
  - A rule in the review prompt of the `implementation-review` skill. Both
    reviews found these gaps without such a rule. A acts earlier, before a fix
    round.
- **Wider fix:** A. It is a rule, not a structural fix. No structural fix
  covers both gates, because they work in different ways. C is a detection
  fix. The review checks read the source of these two gates. The usual
  mutation operators of the dispatch gate already fail an existing test. In
  the cold wait, the same kind of mutation turns a sibling test into a race or
  a hang. So a tool reports no surviving mutation there. Neither check ran a
  tool or read its operator list.
- **Previous examples:**
  - `eager_dispatch_and_classification_wait_for_their_usage_boundaries`, in
    `crates/mokly-server/src/_tests_/eager_usage_tests.rs:63`, built one route
    at the review. With one route, the `dispatched` signal at
    `crates/mokly-server/src/background.rs:129` fires at the same point with
    and without its `routes.peek().is_none()` condition.
  - A reading of the source shows that this test still passes without that
    condition, and when the signal moves before the loop.
  - `eager_cold_sources_wait_for_serve_readiness`, in
    `crates/mokly-cli/src/_tests_/eager_cold_gate_tests.rs:50`, has a mock that
    sends an event for each readiness check before it reads the latch. The
    test then reads the latch itself, opens readiness, and joins the wait.
  - That test never checks that the wait was still pending before the
    release. So its tuple `(true, false, true)` also holds when the wait
    returns at once.
  - A lint-clean break also passes it: delete the `!` before
    `self.cancel.cancelled()` in `SourceWait::enter`, in
    `crates/mokly-cli/src/serve_eager_source_gate.rs:95`. The wait then returns
    at once, but it still checks readiness.
  - The caller at `crates/mokly-cli/src/changes_base_sources.rs:104` to line
    110 picks the lease state. A caller that always claims a complete lease
    passes every test too.
  - The independent checks read source only. On 2026-11-21 the branch applied
    test-only direct fixes. The dispatch test uses three routes and a window
    of one. The cold tests record readiness values and completion in order.
    The caller test includes the no-lease case.
  - The branch then ran four temporary mutations. Early dispatch and pre-loop
    dispatch failed the render-order assertion. Wait bypass failed the
    readiness-recheck assertion. Always claiming a lease failed the literal
    unleased-state assertion. Each product file was restored after its run.
  - `plans/follow-ups/deployment-failure-test.md` records a browser test whose
    title names a step failure. It can pass on an abort alone.
  - Commit `673edf8c5` added assertions for the pnpm and Yarn hook guards of
    private base installs. Before it, no test asserted those guard variables.
    Four temporary guard mutations then failed the new assertions.
- **Recommendation:** A. It puts the missing step where authors read before
  they write a gate test, and it adds no gate.
- **Action:** ask the user, because A changes the shared `testing` skill, a
  rule in force, and no recorded user decision covers that change.
