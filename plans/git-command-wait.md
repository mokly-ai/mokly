# Reduce Git waiting during kept-base checks

Status: Active. On branch `calummoore/mokly-git-command-wait-kvvh`, no pull request exists yet. The completing pull request deletes this plan.

Serve keeps a historical catalogue for Changes. Each edit checks that this
base still has the exact dependency inputs and checkout identity recorded
during preparation. Git command supervision adds fixed waiting to this check.
Some commands also copy the core's page tables when they start.

The target is a mean reduction of at least 25 ms in `review.base-tree` on
`mokly-cloud`. Measure six interleaved rounds against the last merged `main`.
Keep all output and freshness decisions. Keep whole-tree cgroup anonymous
memory plus swap within 5% of the baseline. Add no setting, gate, retry,
sleep, or process. The user holds every merge into `main`.

## Authority and contracts

The performance orchestrator made these calls on 2026-11-18 and 2026-11-19:

- Replace fixed Git completion polling with event-based completion.
- Keep cancellation, timeout errors, output bounds, and the one-second
  SIGTERM-to-SIGKILL rule exact.
- Check whether candidate listing can start helpers before any mode change.
- Report each Serve working-input read path. Use known paths only when
  they prove the same freshness decision.
- Retain the checkout identity and CSS reference memo already on `main`.
- Retain the sized-tree missing-object preflight improvement already on `main`.

Reason: On 2026-11-16, the user delegated speed and reliability decisions
for Changes to the performance orchestrator. The user prohibited changes
that can exhaust machine memory.

On 2026-11-19, the orchestrator requested a further option. Keep full-tree
ownership while removing the full fork. The request is an input, not approval
of a spawn mechanism. The orchestrator also cautioned against disabling
fsmonitor, because large untracked scans can become slow.

The fresh options check of 2026-11-19 retains decisions 1 A and 3 A.
It changes decision 2's recommendation from C to B. Its source analysis
finds that `ls-files` does not use Git's untracked cache. A one-time
large-tree scan comparison will check that finding before the mode changes.
The full report is `.context/git-command-wait/options-check.md`.

Contract owners:

- [Git command runtime](../docs/protocol/mokly-git.md).
- [Base preparation](../docs/protocol/mokly-base-preparation.md).
- [Dependency selection](../docs/protocol/mokly-base-dependencies.md).
- [Git crate](../crates/mokly-git/README.md).
- [Compare crate](../crates/mokly-compare/README.md).
- [Test timing](../docs/protocol/ci-test-timing.md).

## Design and options

### 1. Remove fixed completion waits

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-git/src/system.rs`.
- **Background:** The Git runner writes stdin and drains both output pipes on scoped threads. It checks child and pipe completion every 5 ms.
- **Problem:** Completed commands wait for the next fixed poll. Checkout identity runs three commands. Renderer discovery adds `ls-files` when inputs stay unchanged.
- **Impact if no action:** Serve edits retain avoidable delay.
- **Root question:** How can the Git runner return promptly while it preserves exact supervision and complete output?
- **Options:**
  - **A.** Keep a polling supervisor but wake it on child and pipe completion. Use a scoped child-wait thread, explicit completion state, and park permits. Effort: Medium.
  - **B.** Replace command supervision with an asynchronous process runtime. Reuse cancellation and deadline facilities through a broader boundary change. Effort: Large.
  - **C.** Use platform process notifications and pipe readiness directly. Maintain separate Unix and Windows implementations. Effort: Large.
- **Left out:** A shorter poll adds wakeups and violates the requested mechanism. Blocking only on the child can miss cancellation and open pipes.
- **Wider fix:** A. Every output mode uses one completion path.
- **Previous examples:** Existing cancellation state machine and concurrent pipe readers in `mokly-git`.
- **Recommendation:** A. It removes completion delay with the smallest boundary change.
- **Action:** fix now, apply A. This is the performance orchestrator's call of 2026-11-18 and 2026-11-19.

Shared assumptions come from the task and Git runtime contract. Command
settlement includes the child and all pipes. Cancellation remains observable
while waiting. Timeout precedence and the shutdown grace period remain exact.
No ownership or capture limit changes are part of this decision.
The SystemClock pause can park until a worker unparks the supervisor.
Keep each completion flag separate from thread-handle completion. Preserve
the injected clock API and fake-clock behavior. Publish completion on unwind.

### 2. Remove full-fork cost safely

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-platform/src/unix.rs` and `crates/mokly-git/src/access.rs`.
- **Background:** Candidate listing uses full-tree ownership. Unix configuration calls `setsid` and Linux subreaper setup from `pre_exec`. This forces a full fork.
- **Problem:** Candidate listing can invoke the user's fsmonitor hook. An unconditional plain group would weaken process ownership.
- **Impact if no action:** Full-fork cost may prevent the required 25 ms reduction.
- **Root question:** How can kept-base Git commands start at lower cost while they retain exact output and own every possible helper?
- **Options:**
  - **A.** Keep full-tree spawning and ship the event-wait improvement alone. Verify whether it meets the measured goal. Effort: Small.
  - **B.** Disable fsmonitor only for each file listing and use a plain group. Prove equal output and directory reads on a large untracked tree. Effort: Small.
  - **C.** Preserve fsmonitor and full-tree ownership through a forkless exec trampoline. Require readiness and exec-error framing, packaging, signal parity, and safe cancellation. Effort: Large.
  - **D.** Implement a dedicated native vfork-style spawn boundary. Restrict shared-address-space child work to safe syscalls and support macOS explicitly. Effort: Large.
  - **E.** Read effective fsmonitor configuration when opening a repository. Use B only for an unset or false value. Keep full-tree ownership otherwise. Effort: Medium.
- **Left out:** Unconditional plain-group listing breaks the helper-free rule. Moving orphan ownership to the core changes ownership rules.
- **Wider fix:** B can make every existing file listing helper-free. C remains a wider optimization for commands that must run helpers.
- **Previous examples:** `configure_plain` already avoids `pre_exec` for helper-free commands.
- **Recommendation:** B. The fresh options check replaces the provisional C. Git does not use its untracked cache for `ls-files`, so fsmonitor cannot shorten this scan.
- **Action:** ask the user, because the user requested a call before any process-mode change. Send one options-checked recommendation to the performance orchestrator.

Shared assumptions come from the task and Git runtime contract. Keep the
same number of command processes. A trampoline must exec into Git in the
same process. Retain Linux subreaping, session ownership, escaped-helper
cleanup, exact errors, and macOS behavior. Do not implement this decision
until the orchestrator answers. Continue independent event-wait work.
The parent's profiles already measured the Linux full-fork cost. The
options check's claim that this cost is unmeasured does not apply.
Reject a raw Rust `vfork` call. A trampoline runs after a fresh exec,
but it needs a readiness gate before group signals and exact spawn-error
reporting. macOS can keep the existing full-tree path for C or D.
Option E adds a process at repository open and does not meet the task's
process-count constraint. B requires the parent's explicit override call.

### 3. Preserve exact working-input discovery

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-compare/src/base_freshness.rs`, `crates/mokly-cli/src/base_dependencies.rs`, and `crates/mokly-cli/src/changes_freshness.rs`.
- **Background:** HTML records every governing dependency path, including absent paths. Renderer preparation records a complete candidate inventory instead.
- **Problem:** Reading only previously present renderer inputs misses newly added manifests and lockfiles.
- **Impact if no action:** An incomplete replacement could accept a stale historical base.
- **Root question:** Which input discovery can preserve every freshness decision without unnecessary Git work?
- **Options:**
  - **A.** Retain scoped HTML reads and complete renderer discovery. Optimize the shared Git runner. Effort: Small.
  - **B.** Retain an exact complete candidate inventory through watcher evidence. Prove all invalidation sources, including ignores and Git configuration. Effort: Large.
  - **C.** Derive a complete bounded governing-path set for renderer dependency selection. Prove equivalence before replacing discovery. Effort: Large.
  - **D.** Share one exact listing between classification and freshness. Prove that both consumers use the same valid snapshot. Effort: Large.
- **Left out:** Saved present paths omit newly added dependency inputs. A metadata-only digest cannot prove normalized content equality.
- **Wider fix:** A retains the existing exact boundary for all callers.
- **Previous examples:** HTML selection already stores absent governing candidates in `selection.paths`.
- **Recommendation:** A. The existing renderer inventory owns discovery that the saved inputs cannot replace.
- **Action:** fix now, apply A. This is the workspace orchestrator's call of 2026-11-19, subject to the fresh options check.

The task requires every existing freshness decision. The selection code
proves why HTML and renderer paths differ. Do not extend stored evidence
or watcher invalidation in this change without a new options check.

## Replaced ways

- Fixed completion polling becomes completion events in the Git runner.
  Consumers: capture, digest, exact copy, bounded copy, explicit cancellation,
  deadline execution, and the `FastClock` and `HangClock` integration-test clocks.
  Preserve the injected clock behavior. Remove the old completion loop in Milestone 2.
- A forkless full-tree spawn remains conditional on decision 2. If approved,
  list and migrate every affected consumer before implementation starts.

## Milestone 1: Documentation and baseline

Depends on: none

Confirm the existing contracts and measure the unmodified implementation.
The docs implementor audits contract alignment. Update a README only when
new entry points need a link. Observable behavior remains unchanged.

- [x] Obtain a fresh options check for every design call and merge its report.
- [x] Send the options-checked process-mode decision to the performance orchestrator.
- [ ] Commit and push this plan before implementation.
- [x] Audit the Git, freshness, and dependency docs through the docs implementor.
- [x] Measure `main` release on `examples/basic` and generated large fixtures first.

Evidence: `.context/git-command-wait/` holds the ledger, prompts, baseline, and options report.

## Milestone 2: Event-based command completion

Depends on: 1

Delegate the runner and test work to the non-ui implementor. Preserve all
existing tests. Add focused regression cases only for behavior that the
existing tests do not protect.

- [ ] Replace fixed completion waits with child and pipe completion events.
- [ ] Preserve cancellation, timeout precedence, exact errors, output limits, and one-second escalation.
- [ ] Preserve the existing `FastClock` and `HangClock` tests through the injected clock boundary.
- [ ] Prove complete output when the child exits first and when the pipes close first.
- [ ] Show new behavior tests fail before the fix, where applicable.
- [ ] Run each new asynchronous test ten times and record its cost.
- [ ] Confirm the working-input read-path report against all Serve edit variants.

## Milestone 3: Approved spawn work and measurements

Depends on: 2

Implement only the process-mode option that the performance orchestrator
approves. Keep this milestone open until the answer and measurement outcome.

- [ ] Record the process-mode answer and its date. Expand migration TODOs if needed.
- [ ] Delegate the approved spawn work and exact ownership regression coverage, if any.
- [ ] Run six interleaved release rounds against current `main`, with separate checkouts and target directories.
- [ ] Compare three edit windows for `review.base-tree` and `changes.classify` on each fixture.
- [ ] Compare exact output and freshness observations and whole-tree cgroup anonymous memory plus swap.
- [ ] Send the pushed implementation SHA immediately for the orchestrator's `mokly-cloud` measurements.
- [ ] Confirm at least 25 ms mean reduction on `mokly-cloud` and no memory rise above 5%.

## Milestone 4: Verification, review, and pull request

Depends on: 1, 2, 3

The orchestrator owns the combined gate, commits, review, and pull request.
Use Git 2.45 or later first on PATH, git-lfs, and the pinned Bun version.
Check disk and memory before every large Cargo build. Use separate targets,
disable incremental compilation and development debug information, and run
Cargo builds one at a time.

- [ ] Run the Git, compare, graph, and Serve targeted tests unchanged.
- [ ] Run `cargo xtask check --suite repository` and the complete `cargo xtask check` gate with locked dependencies.
- [ ] Commit with Conventional Commits and push the implementation.
- [ ] Review the complete diff against `origin/main` after the push with the implementation-review skill. Confirm findings, run up to two fix rounds, and record follow-ups.
- [ ] Merge current `origin/main` with the git-merge skill when it advances. Preserve the sidecar warm-up change if it merges first.
- [ ] Delete this plan after the other required TODOs and review rounds complete.
- [ ] Open the pull request into `main`. Preserve dated decisions, design calls, the plan permalink, and follow-up items in its description.

After the pull request opens, wait for its CI with the finish-work skill's
`scripts/ci-wait.sh`. Fix failures under the testing rules. Report every CI
result and remaining item to the performance orchestrator. Do not merge.
