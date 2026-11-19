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
- **Action:** fix now, apply B. The performance orchestrator approved B on 2026-11-19 under the user's delegation of 2026-11-16.

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

The parent's call requires one listing path that binds the override and
plain-group ownership. Apply it only to both existing file listings. Keep
all other command modes. Tests must capture both requests and prove that
a configured monitor hook stays unused while listing output stays equal.
Record Git 2.49.0 source lines, the 100,000-file proof, and the `git status`
cache distinction in the Git protocol. This explicit documentation request
also permits its source citations and result summary.
The approved mode change updates the listing expectation in
`changes_preserve_renames_and_add_untracked_paths` from FullTree to PlainGroup.
Keep its tracked-diff mode and every output assertion. This is the necessary
test update for the parent's call of 2026-11-19.

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

### 4. Keep release comparison inputs equal

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** test.
- **Location:** The ignored release measurement controller.
- **Background:** Bundle identity includes physical source, dependency, and repository roots. Separate runtime checkouts supplied different roots.
- **Problem:** Generation fields differed before the core implementation could be isolated.
- **Impact if no action:** The exact cross-arm comparison cannot complete.
- **Root question:** How can release measurements isolate the core implementation?
- **Options:**
  - **A.** Use main's runtime checkout, dependency tree, dist, and normal CLI entry. Atomically install each immutable release binary before its run. Verify and restore the packaged executable. Effort: Small.
  - **B.** Prepare a third shared runtime checkout and dependency tree. This adds setup and another identity to validate. Effort: Medium.
  - **C.** Use a custom launcher that selects an immutable core directly. This needs a separate environment, signal, and package-selection proof. Effort: Medium.
  - **D.** Bind the selected executable read-only into each service. This avoids package replacement but adds a mount namespace and another harness adapter. Effort: Small.
- **Left out:** Separate physical roots retain unequal inputs. A product identity change exceeds this task. Mirrored containers add infrastructure without a required benefit.
- **Wider fix:** A. One explicit runtime checkout governs every arm and fixture.
- **Previous examples:** The large fixtures already share their dependency paths. The cloud measurement uses main's dist for both cores.
- **Recommendation:** A. The fresh options check retained the normal CLI and the saved main runtime identity.
- **Action:** fix now, apply A. The performance orchestrator made this call on 2026-11-19 under the user's delegation of 2026-11-16.

Reason: physical roots are identity inputs. Keep them equal and change only
core executable bytes. Source checkouts and Cargo release targets remain
separate. Pin both source commits and binary digests. Preserve raw evidence.
Use one shared warm cache per repository. Keep cold and cross-root samples
outside the controlled means. Compare six-round memory means and spreads.
Report example phase and process peaks before the PR if its branch mean
exceeds main by 5%.

The check added option D. Its namespace changes the process context, so A
remains selected. Root added immutable-source and installed-inode checks.
The committed-source release build retains the measured binary digest.
Evidence: `.context/git-command-wait/shared-inputs-options-check.md` and
`.context/git-command-wait/measurement-inputs-decision.md`.

### 5. Compare intentional generation randomness

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** test.
- **Location:** The ignored release comparison oracle.
- **Background:** A non-reusable bundle hashes a random runtime key into its identity. The key reaches the live generation and the comparison URL.
- **Problem:** Saved main/main React edit controls differ in these two values while all other captured output matches.
- **Impact if no action:** Intended existing randomness stops the release comparison.
- **Root question:** How can the comparison prove unchanged captured output when existing identities contain randomness?
- **Options:**
  - **A.** Derive a phase policy from actual main/main controls. Exclude only the live generation value and the comparison URL's hash segment in proven phases. Keep every other captured field and within-run freshness check exact. Effort: Small.
  - **B.** Add separate comparison-route captures outside the timing sample. This broadens public route coverage but cannot expose the private review and snapshot serializations by itself. Effort: Medium.
- **Left out:** Raw random-value equality cannot complete. Seeds, shared sidecars, or product identity changes alter the fixed runtime. Whole-field removal drops required observations. Consistent renaming adds no check beyond A and the existing within-run generation checks.
- **Wider fix:** None within the parent's exact two-value limit. A is the confined direct fix.
- **Previous examples:** The performance orchestrator reports the same React edit rule in workspace 47 on 2026-11-18. Current main/main controls independently prove it.
- **Recommendation:** A. The fresh options check retained the approved rule and all 36 valid samples.
- **Action:** fix now, apply A. The performance orchestrator made this call on 2026-11-19 under the user's delegation of 2026-11-16.

Reason: `bundle.ts` creates `randomBytes(24)`. `bundle-recipe.ts` hashes the
runtime key when reuse evidence is incomplete. The six relevant source files
are identical between main and the branch. Twelve main/main phase controls
permit only the three React edit phases. All example and HTML phases and
React initial retain full comparison. Keep live object presence and other
fields. Keep every character outside the comparison URL's hash. Validate
hash shape and preserve raw values. Keep body, detail, document-key, and
within-run descriptor and generation-change checks.

The control validates captured routes. It does not claim every historical
comparison route or private review and snapshot serialization. Revalidate
masked indexes as canonical JSON bytes so scalar types remain distinct.
Reuse completed valid runs without resampling. Preserve invalid observer
attempts separately. No product source, setting, timeout, or test changes.
Evidence: `.context/git-command-wait/generation-rule-options-check.md`,
`.context/git-command-wait/baseline/generation-value-policy-e8323008b.json`,
and `.context/git-command-wait/baseline/interleaved-final-audit-e8323008b.json`.

## Replaced ways

- Fixed completion polling becomes completion events in the Git runner.
  Consumers: capture, digest, exact copy, bounded copy, explicit cancellation,
  deadline execution, and the `FastClock` and `HangClock` integration-test clocks.
  Preserve the injected clock behavior. Remove the old completion loop in Milestone 2.
- Full-tree file listings become the approved listing helper with an fsmonitor
  override and plain-group eligibility. Consumers: candidate discovery and
  changed-path untracked discovery. Keep the existing promisor fallback.
  Move both callers and remove their old direct listing requests in Milestone 3.

## Milestone 1: Documentation and baseline

Depends on: none

Confirm the existing contracts and measure the unmodified implementation.
The docs implementor audits contract alignment. Update a README only when
new entry points need a link. Observable behavior remains unchanged.

- [x] Obtain a fresh options check for every design call and merge its report.
- [x] Send the options-checked process-mode decision to the performance orchestrator.
- [x] Commit and push this plan before implementation.
- [x] Audit the Git, freshness, and dependency docs through the docs implementor.
- [x] Measure `main` release on `examples/basic` and generated large fixtures first.

Evidence: `.context/git-command-wait/` holds the ledger, prompts, baseline, and options report.

## Milestone 2: Event-based command completion

Depends on: 1

Completed on 2026-11-19. Evidence: `.context/git-command-wait/reports/event-wait.md`.

Delegate the runner and test work to the non-ui implementor. Preserve all
existing tests. Add focused regression cases only for behavior that the
existing tests do not protect.

- [x] Replace fixed completion waits with child and pipe completion events.
- [x] Preserve cancellation, timeout precedence, exact errors, output limits, and one-second escalation.
- [x] Preserve the existing `FastClock` and `HangClock` tests through the injected clock boundary.
- [x] Prove complete output when the child exits first and when the pipes close first.
- [x] Show new behavior tests fail before the fix, where applicable.
- [x] Run each new asynchronous test ten times and record its cost.
- [x] Confirm the working-input read-path report against all Serve edit variants.

## Milestone 3: Approved file listings

Depends on: 2

Completed on 2026-11-19. Implement the approved process-mode option.
Evidence: `.context/git-command-wait/reports/file-listings.md` and
`.context/git-command-wait/reports/listing-docs.md`.

- [x] Record the process-mode answer and its date. Expand migration TODOs if needed.
- [x] Delegate the approved spawn work and exact ownership regression coverage, if any.
- [x] Move both file listings to one override-bound request path. Preserve the existing promisor ownership fallback.
- [x] Prove both request modes and override arguments. Prove equal output without invoking a configured marker-writing hook.
- [x] Update the Git protocol and crate README under the parent's source, scan-proof, and status-cache documentation conditions.

## Milestone 4: Verification and implementation push

Depends on: 1, 2, 3

The orchestrator owns the combined gate and the implementation push.
Use Git 2.45 or later first on PATH, git-lfs, and the pinned Bun version.
Check disk and memory before every large Cargo build. Use separate targets,
disable incremental compilation and development debug information, and run
Cargo builds one at a time.

- [x] Run the Git, compare, graph, and Serve tests with the one approved listing-mode expectation update.
- [x] Run `cargo xtask check --suite repository` with locked dependencies.
- [x] Run the complete `cargo xtask check` gate with locked dependencies.
- [x] Check current `origin/main` and merge it with the git-merge skill when it advances. Preserve the sidecar warm-up change if it merges first.
- [x] Commit with Conventional Commits and push the implementation.
- [x] Send the pushed implementation SHA immediately for the orchestrator's `mokly-cloud` measurements.

The local complete gate remains blocked by the existing saved-plan flake.
Evidence: `.context/git-command-wait/check-complete.log` and
`.context/git-command-wait/check-complete-2.log`. The final CI aggregate must pass.

## Milestone 4a: Interleaved render diagnostics

Depends on: 4

The performance orchestrator requested this check on 2026-11-19. Compare
the complete render integration binary on otherwise idle runs. Keep the
gate profile and test-thread settings. Use `main` at `6ae96ed08`.

- [x] Run ten render integration binaries per arm in interleaved order.
- [x] Count the plan-invalidation failures for each arm.
- [x] Report both failure counts to the performance orchestrator. Record occurrences in the PR body under the current ownership of PR #352.

The performance orchestrator accepted the diagnostic comparison. PR #352
owns the harness fix and deletes the existing follow-up. Keep the already
committed record until that PR merges. Add no new record to that file.
Evidence: `.context/git-command-wait/reports/interleaved-render-diagnostics.md`.

## Milestone 5: Release measurements

Depends on: 4

Keep the tested implementation fixed while both machines measure it. The
orchestrator measures local fixtures while the performance orchestrator
measures `mokly-cloud` on its own machine.

- [x] Build both releases in separate checkouts and targets. Run six balanced rounds with the approved shared runtime and dependency tree.
- [x] Compare three edit windows for `review.base-tree` and `changes.classify` on each fixture.
- [x] Compare captured output under the approved identity rule, exact freshness observations, and whole-tree cgroup anonymous memory plus swap.
- [x] Confirm at least 25 ms mean reduction on `mokly-cloud` and no memory rise above 5%.

Completed on 2026-11-19. All valid samples remain included. The offline
artifact, source, binary, memory, and typed-JSON audits passed. The report
keeps the stopped cross-root setup, observer repair, and audit-file timing
limit. Evidence: `.context/git-command-wait/reports/interleaved-measurements.md`
and `.context/git-command-wait/baseline/interleaved-final-audit-e8323008b.json`.

## Milestone 6: Review and pull request

Depends on: 4a, 5

Keep the review and pull request with the orchestrator. The implementation
push starts the performance orchestrator's measurement before local rounds.

- [x] Confirm the implementation push. Commit and push each approved review fix with its checks.
- [x] Review the complete diff against `origin/main` after the push with the implementation-review skill. Confirm findings, run up to two fix rounds, and record follow-ups.
- [x] Merge current `origin/main` with the git-merge skill when it advances. Preserve the sidecar warm-up change if it merges first.
      The fresh production review found no in-scope issue. No finding check or
      fix round was needed. Existing outside items retain their owners. Main
      `f4f0082fd` was merged with a clean two-parent preservation audit. It updates
      `AGENTS.md` only. Evidence: `.context/reviews/calummoore/mokly-git-command-wait-kvvh/`
      and `.context/git-command-wait/merge-audit-f4f0082.txt`.

- [ ] Delete this plan after the other required TODOs and review rounds complete.
- [ ] Open the pull request into `main`. Preserve dated decisions, design calls, the plan permalink, and follow-up items in its description.

After the pull request opens, wait for its CI with the finish-work skill's
`scripts/ci-wait.sh`. Fix failures under the testing rules. Report every CI
result and remaining item to the performance orchestrator. Do not merge.
