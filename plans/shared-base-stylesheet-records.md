# Share validated head stylesheet records with the base

Status: Active. On branch `calummoore/mokly-first-changes-3-shared-base-pp6b`, no pull request yet. The pull request that completes the work deletes this plan.

Mokly prepares the historical base before it publishes Changes. Each base preparation currently bundles stylesheet roots again. This step lets a base read a head stylesheet record when the existing record validation proves every observed input equal. Each miss still bundles on the base side.

## Approved scope and history

On 2026-11-19, the user chose option D for “First Changes takes 12 to 14 s after Serve starts”. The choice is five stacked performance changes. They are miss-first base capture, equal-document comparison, shared base stylesheet records, busier head sidecars, and render retention across Serve restarts. This plan covers the third change. The user rejected stopping with only measurements or one isolated optimisation. The reason is earlier first Changes with the same result.

On 2026-11-19, the user authorised further stacked pull requests without repeated approval. Exact output and bounded memory remain requirements. On 2026-11-16, the user put speed and reliability first and rejected changes that can exhaust memory. The user holds every merge into `main`.

The performance orchestrator made these calls on 2026-11-19:

- Investigate fresh base stores before implementation. A shared result must preserve the rule that caused isolation.
- Reuse only through existing `lookup`, stamp checks, and evidence replay. A missing proof must cause a base bundle.
- Give the base read-only access to head records. Keep base misses in its own store to protect head records from base eviction.
- Keep `SerialStylesheets`, root scheduling, sidecar admission, pool size, and render-cache bounds. These rules protect foreground work and memory.
- Compare shared and separate base output for equal CSS, changed CSS, imports, assets, PostCSS configuration, Tailwind content, and dependency versions. These cases protect the input boundary.
- Keep real `css.bundle` spans and their cache outcomes. The performance proof must count base `cache=no-record` spans.
- Start from current `origin/main`, then stack on step 2. Merge `origin/main` once only after the orchestrator reports PR #350 merged. This avoids repeated integration while the monorepo changes.

The performance orchestrator added these calls on 2026-11-19 after the initial evidence read:

- Omit the physical source root only for plain CSS records with complete resolution evidence. PostCSS records keep the physical source root in their key.
- Retain every resolution read and probe. This includes each read `package.json` field, every tried extension candidate, and every absent candidate. Validate this evidence through the existing lookup and replay rules.
- Add red-first base tests for a changed `style` or `exports` entry and an earlier candidate that appears. These cases protect the selected input from resolution changes.
- Complete the evidence extension in this branch when its effort is Medium or smaller. Stop and report the size and options when it is larger.
- Reproduce any existing stale head-generation reuse before fixing it. Send the failing test result to the orchestrator first. Correctness comes before the speed change.

Step 2 is [PR #355](https://github.com/mokly-ai/mokly/pull/355), branch `calummoore/mokly-first-changes-2-byte-equal-fast-10j4`. The start commit is `c2fe4bf2a4043e315eb888b86542cb44ec93cce0`. Earlier performance evidence used `6ae96ed08`.

The three head-generation tests reproduced stale CSS on 2026-11-19. Each returned the `.before` selector after resolution selected the file with the `.after` selector. The defect is High. The performance orchestrator chose a separate correctness pull request into `main`, ahead of the speed stack. Its branch is `calummoore/mokly-stylesheet-resolution-evidence`, from current `origin/main`, without PR #355 or the base lookup. This workspace implements and pushes that fix. The orchestrator then creates the workspace that owns its review, complete gate, pull request, and CI. The fix commit records the exact failures. It gets no follow-up item.

After that push, merge the fix branch into this branch. The performance orchestrator will give the final stack order with PR #355. Report capture cost from `css.bundle` spans on `examples/basic` and both large fixtures. Report a cost above about five percent. Correct output comes before the speed work.

On 2026-11-20, the performance orchestrator reported PR #350 merged at `5cba4dc4b`. The correctness branch integrated that main commit once. The integration preserved the complete in-progress fix. Rust is now 1.98.1. This branch will receive that main content through the correctness branch.

The performance orchestrator also included the CSS-only watch gap in the correctness fix on 2026-11-20. Captured resolution files and directories must reach Serve's watch inputs. A red-first test changes only a package `style` entry in one Serve session and requires updated published CSS. If that extension exceeds Medium, ship the reuse fix first and record the separate High watch gap as a follow-up item.

The correctness fix is pushed at `95d89823d83972deb3fbb7acf7e3aec3792a56aa`. The merged repository suite passed. This branch merged that fix at `1bbad0f05`, preserving the monorepo and both README changes. The performance orchestrator owns the fix's review, full gate, pull request, and CI in a separate workspace. Its CSS cost report is still due.

On 2026-11-20, the performance orchestrator reported step 2 merged into `main` at `9fb9ad1f9a`. Its branch is deleted. Build the base lookup on the correctness fix. Before opening this pull request, merge current `origin/main`, which holds step 2. Target the fix branch while its pull request is open. Target `main` after the fix merges. This replaces the earlier instruction to merge the step 2 branch.

On 2026-11-20, workspace 130 took ownership of the correctness branch. The local CSS cost report was sent to that workspace and the performance orchestrator. This branch integrated its later alias watch correction at `079b465e15d009bfa286ecfdca92c0f93b063da6`. Both branches contain `main` at `a2f61eb53`. The merge kept every prerequisite change without a conflict. The performance orchestrator dropped the proposed historical evidence reduction. Head capture and base validation and replay stay complete.

On 2026-11-20, the performance orchestrator reduced the remaining local measurement scope. Run one interleaved warm pair on `examples/basic`, large HTML, and large React. Record time and whole-tree memory as smoke evidence. Do not run the planned 72-startup and 36 ten-edit local matrix. The accepted six-round Mokly Cloud measurement at `76c797ccb` is the acceptance evidence. The strict 44,025-file byte proof settles output equality.

The orchestrator will confirm the final integration against `main` after the correctness fix merges. This avoids repeating the accepted performance work. Record this call in the pull request body.

After the fix merges, merge `origin/main` once. Send the resulting SHA for confirmation. Open the pull request.

The performance orchestrator added basic PostCSS coverage on 2026-11-20 after a high single smoke sample. Compare prerequisite `e63a48c9b` with `ac905b8d9` in three interleaved warm pairs. Give every measured process a fresh-cache Serve primer, excluded from the means. Report separate head and base catalogue cache outcomes, the first Changes, base preparation, CSS spans, and peak memory.

The first set used `/tmp` caches and included one missing warm base record. On 2026-11-20, the orchestrator requested a quiet-cache repeat under the checkout target. Keep all earlier samples. Change no durability rule or product code. The known ancestor-churn mechanism can skip a complete capture whose witnesses are not durable. The exact old rejected witness is not present in the logs.

On 2026-11-20, the orchestrator accepted the quiet basic speed result. Every measured catalogue was a hit. The parent treated the memory pattern as known single-peak noise, with different main commits as another confound. It chose no further basic memory chase. Preserve the measured memory uncertainty in the pull request body. The final common-main check includes six interleaved Cloud rounds and two cold ten-edit sessions per arm.

On 2026-11-20 at 06:57 UTC, the orchestrator reported PR #384 merged at `940ddd742`. It instructed this branch to merge `origin/main` once and send the resulting SHA. Open this pull request against `main` only after the final confirming result. Then wait for CI. This replaces the earlier instruction to target the open correctness branch.

On 2026-11-20, the orchestrator accepted the final common-main check of `709635cd7` against `940ddd742`. It accepted speed and memory, including the cold ten-edit sessions. It instructed this workspace to open the pull request against `main` and wait for CI. The orchestrator holds the merge. Site Lighthouse is known and outside Required CI.

Evidence: `.context/shared-base-stylesheets/evidence/cloud-709635-confirmation.md` records the final confirmation. `post-merge-repository.log` records the successful repository suite after integration.

## Contract owners

- [Base preparation](../docs/protocol/mokly-base-preparation.md).
- [Imported stylesheet processing](../docs/protocol/mokly-imported-styles-postcss.md).
- [PostCSS contexts and evidence](../docs/protocol/mokly-sidecar-postcss.md).
- [Watch freshness](../docs/protocol/mokly-watch.md).
- [Timing records](../docs/protocol/mokly-timings.md).
- [Render runtime](../crates/mokly-render/README.md).

## Why the base starts fresh

The Rust runtime already created fresh stores in `d935e6a66`. Generation stylesheet reuse and the physical `side.source_root` key arrived in `471ba39a5`. PR #242, commit `ee7d8ea73`, explicitly deferred the base's remaining `no-record` bundles to later performance work. PR #344, commit `3e624480e`, introduced `Runtime::for_base` while preserving those stores. It added sharing of the syntax memo.

The protocol requires separate source roots and separate PostCSS process state. It does not require separate immutable stylesheet result records. The existing source-root key nevertheless protects output that depends on a physical PostCSS root. That key cannot be removed without proof.

The CSS resolver reads resolution files and probes candidates. Current records do not retain those reads or every path projection. The independent investigation confirms that plain CSS replay currently has no such evidence. A Medium extension can record these inputs at the source-tree boundary. The orchestrator's later call authorises that extension. PostCSS keeps its physical key and separate process state. The investigation report lives at `.context/shared-base-stylesheets/evidence/history-review.md`.

## Design

A base runtime keeps its own writable stylesheet store. It holds a weak read-only reference to the head store. Lookup checks the base store and then eligible head records. Each candidate passes the same stamp and context validation in the base's `SideTree`. Delivery replays the original evidence into the base tree. A hit shares record storage. A miss writes only the base store. A failed head candidate reports `stamp-mismatch`. An absent candidate preserves the applicable existing miss reason.

Both stores keep their existing 64 MiB bounds. Attempt-local retention keeps its existing bound. Sharing must not create an unbounded index or retain evicted records outside the existing owners. Base compilation state, PostCSS contexts, and bundle stores stay separate.

Eligibility keeps every effective setting that can change output. The key keeps `config.input`, `config.modules`, `side.module_resolution`, and the complete effective `Resolution` settings. These settings include the configuration directory, dependency aliases, conditions, main fields, logical dependency roots, and extensions. A physical PostCSS source root remains in its key. A plain CSS key drops only that physical root, with complete resolution evidence. Plain CSS must still prove its CSS sources, import targets, URL assets, resolution files and candidates, and selected dependencies. Existing failed validation takes the normal bundle path.

The resolution evidence covers successful reads and failed candidates. It must detect a changed package entry and an earlier candidate appearing. Give each root compilation its own recording tree, compiler, and resolver. Capture each core CSS read, digest, unretained digest, and projection through that boundary. Retain logical paths, returned digests, and projected nodes, including absence. Use the digest of the whole returned `package.json`, which covers every selected field without per-field rules. Store no additional file payloads. The existing stamp compares those results in a later attempt, including the base. Replay preserves captured byte observations. Charge all new metadata to the existing store bounds. This is the workspace orchestrator's call of 2026-11-19. It prevents future resolver reads from escaping manual per-call evidence lists.

Capture does not assume serial roots. Head preparations and non-Serve base preparations can compile roots in parallel. Only Serve keeps its existing serial base wrapper. The head correctness fix covers the core CSS compiler and resolver that both plain CSS and PostCSS use. Keep PostCSS's separate context state and existing module evidence. Assess the shared resolver inside PostCSS separately after reproduction. Report any required extension larger than Medium before fixing it.

Extend the existing record stamp and replay path instead of adding a separate acceptance rule. First reproduce any missing head-generation invalidation. Send its failing assertion to the performance orchestrator before applying the fix.

A class of inputs that cannot be proved stops this step. A historical isolation rule with no Small safe change also stops this step. Report that result before implementation.

### 1. Avoid repeated base stylesheet compilation

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-render/src/runtime.rs` and `crates/mokly-render/src/stylesheet_cache.rs`.
- **Terms:** A stylesheet record holds compiled CSS and the evidence used to validate its inputs. A side tree selects repository sources and dependencies for one side.
- **Background:** Head preparations retain bounded stylesheet records. A new base runtime currently starts an empty store. Its first preparation compiles equal roots again.
- **Problem:** Base preparation repeats work whose complete inputs can be equal.
- **Impact if no action:** The first Changes keeps the measured base stylesheet cost of about 0.25 seconds.
- **Root question:** How can the base reuse a head stylesheet when its key and evidence prove equal output within the existing bounds?
- **Options:**
  - **A.** Keep separate compilation. This preserves isolation but meets the task only if the proof investigation requires abandoning the step. Effort: Small.
  - **B.** Copy eligible head records into the bounded base store. Validate and replay each record before delivery. Copies add store work and duplicate indexes. Effort: Medium.
  - **C.** Add read-only head lookup behind the bounded base store. Validate and replay each candidate. Keep all base writes local. Effort: Medium.
  - **D.** C with a direct list of resolver reads and candidates. Every compiler read site must maintain that list. Effort: Medium.
  - **E.** C with one recording tree for each root compilation. The compiler and resolver share that boundary. It retains digests and projections automatically. Effort: Medium.
  - **F.** Make compilation pure after the base reads every input, then reuse content-addressed results. This changes the requested mechanism and leaves the existing head gap. Effort: Large.
- **Left out:** A single writable store violates the required protection from base eviction. Unvalidated byte reuse violates freshness. Larger bounds and more workers violate the task constraints.
- **Wider fix:** E. Capture prevents missing compile reads, and C keeps one validation and delivery path for both stores.
- **Previous examples:** `ee7d8ea73` shares records across head generations. `render_environment.rs` already normalises source roots for render keys under the sidecar contract.
- **Assumptions:** The task requires exact bytes, the existing validator, separate bounds, no head mutation, and serial Serve base roots. Other roots can run in parallel. Eligibility does not assume complete PostCSS coverage.
- **Recommendation:** E, changed from C after the options check. It preserves the bounded read-only lookup and supplies the missing resolution proof.
- **Action:** Apply E under the user's authorisation for a Medium evidence extension. Stop and report if the extension becomes larger.
- **Call:** Workspace orchestrator, 2026-11-19. The reason is to preserve validation and head retention while removing duplicate compilation.

### 2. Keep cache origin independent of watching

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Code structure.
- **Location:** `crates/mokly-render/src/runtime.rs` and `crates/mokly-render/src/stylesheets.rs`.
- **Terms:** An original head owns the first writable store. A base borrows its original head through a weak reference.
- **Background:** The prerequisite owner will make watch mapping an explicit Serve builder option. Build and publish heads will keep mapping disabled.
- **Problem:** The initial base lookup uses the watch flag to distinguish a head from a base. That flag will no longer identify cache origin.
- **Impact if no action:** A head without watch mapping will offer no records to its base. A future workaround could expose a base store.
- **Root question:** How does a runtime identify an original head store across watch modes, base extraction modes, and source lifetimes?
- **Options:**
  - **A.** Add a separate base-origin flag beside the weak reference. It is small but keeps related state in two fields. Effort: Small.
  - **B.** Use an optional weak reference. `None` marks an original head. `Some` marks a base, including an expired or unavailable original source. It adds no separate flag. Effort: Small.
  - **C.** Use an explicit head-or-base enum with the weak reference in its base variant. This names both states but requires more type and module changes. Effort: Small.
  - **D.** Give every runtime an original-head weak source. An original head points to itself. Exclude that same store from its own fallback. This copies store identity and needs extra same-store logic. Effort: Small.
  - **E.** Put the writable store and borrowed source in one private value with three constructors. This limits other runtime code but changes more files and adds a type. Effort: Small.
- **Left out:** A watch flag cannot identify build or publish heads. A live-reference test would promote a base after its head expires. Presence of `BaseSide` misses bases without extraction. Always lending the writable store exposes base stores. A strong reference keeps an expired head store alive. Lookup limited to Serve breaks the non-watching head requirement.
- **Wider fix:** B. One value keeps the base marker and its original source together.
- **Previous examples:** The earlier watch-origin guard already protects no-extraction bases. The prerequisite changes the meaning of its flag.
- **Assumptions:** The user requires read-only original-head lookup, private base stores, independent watch behavior, and unchanged bounds. The prerequisite owner explicitly chose the Serve builder on 2026-11-20.
- **Recommendation:** B, confirmed by the fresh options check. It keeps origin separate from watching without copying the store identity or adding a lookup check.
- **Action:** Apply B. The options check is complete. Preserve the prerequisite Serve builder during integration.
- **Call:** Workspace orchestrator, 2026-11-20. Preserve the new watch boundary and the existing cache ownership rule.

No public format, option, error, scheduling rule, or protocol requirement changes. The differential tests are explicitly required by the user. Keep them even though the testing skill normally treats output equivalence as a one-time proof.

## Milestone 1: Safety and documentation

Depends on: none

- [x] Complete the history and evidence investigation. Stop if the task's safety condition holds.
- [x] Run the fresh read-only options check over this plan's calls. Merge its result before the plan commit.
- [x] Delegate internal documentation to the `docs implementor`. Explain store ownership, eligibility, validation, and base-only writes in the render README.
- [x] Confirm that the protocol already owns every required freshness and isolation rule. Change no protocol requirement.

## Milestone 2: Separate correctness prerequisite

Depends on: 1

- [x] Reproduce stale head reuse for package `style`, package `exports`, and an earlier extension candidate. Send the assertion failures before fixing the code.
- [x] Delegate per-root evidence capture to the `non-ui implementor` in its separate worktree. Include the PostCSS shared resolver when its effort fits Medium. Branch: `calummoore/mokly-stylesheet-resolution-evidence`.
- [x] Turn the three regressions green. Run targeted tests and the repository check on the fix branch.
- [x] Include CSS resolution watch inputs and the real Serve regression when the extension fits Medium. Repeat the new asynchronous test ten times.
- [x] Commit and push the fix branch. Send its SHA, changed paths, exact High defect record, and checks to the performance orchestrator.
- [x] Merge the fix into this branch with the `git-merge` skill. Keep its complete gate, review, pull request, and CI with the orchestrator's new workspace.

## Milestone 3: Bounded record lookup and differential coverage

Depends on: 2

- [x] Delegate code and tests to the `non-ui implementor`.
- [x] Add the new-behaviour test first. Save an assertion failure from the existing implementation.
- [x] Confirm that the prerequisite fix retains and validates every resolution read and candidate, including absence.
- [x] Add read-only head lookup through the existing validation and replay path. Keep base miss insertion and rejection in the base store.
- [x] Preserve resolution evidence or reject a record whose resolution inputs cannot be proved.
- [x] Keep root-dependent PostCSS records isolated unless the existing evidence proves equal effective inputs.
- [x] Add differential shared-versus-separate output coverage for equal CSS, changed CSS, changed imports, changed assets, changed PostCSS configuration, changed base Tailwind content, and changed dependency versions.
- [x] Add red-first base cases for changed package `style` and `exports` entries and an earlier candidate appearing.
- [x] Add a red-first base case for a symbolic link in a path part. Prove one cache hit through the real historical tree.
- [x] Check read-only head behaviour, base-store bounds, evidence replay, misses, and the unchanged timing spans.
- [x] Check all delegated changes against these TODOs and the 300-line Rust cap.
- [x] Update relevant code comments. Align the README with the prerequisite fix and remove its pending status after implementation.

Evidence: `.context/shared-base-stylesheets/evidence/` holds test commands, the red proof, timing costs, and repeated-run results. `origin-options.md` records the second options check.

The later checked prerequisite `e63a48c9b` is integrated. Its Serve-only watch option stays off by default. Its metadata forwarding and advisory candidate mapping stay complete. The cache origin is independent. The final documentation reconciliation is complete. Merge evidence: `.context/shared-base-stylesheets/evidence/round2-merge-decisions.md`.

## Milestone 4: Performance, output, and memory proof

Depends on: 3

- [x] Build release binaries from the last merged `main` and this branch in separate checkouts and target directories. Build Cargo serially with incremental and dev debug disabled.
- [x] Send the prerequisite fix's initial `css.bundle` count and time before and after on the example and both large fixtures. Report a cost above about five percent.
- [x] Check strict `examples/basic` output and large HTML and React fixture output from `scripts/large/` for exact byte equality.
- [x] Run one interleaved warm pair on `examples/basic` and both large fixtures as a time and memory smoke check. Use the accepted six-round Mokly Cloud measurement for acceptance, under the orchestrator's reduced scope.
- [x] Count base `css.bundle` spans and cache outcomes. Keep their existing meaning.
- [x] Run the three requested warm basic pairs against the prerequisite, with excluded cold Serve primers. Preserve their different cache outcomes.
- [x] Repeat the three basic pairs with quiet target caches. Report speed and memory without suppressing the remaining uncertainty.
- [x] Inspect the missing cache record read-only. Keep the existing ancestor-churn rule and make no product change.
- [x] Record whole-tree cgroup anonymous memory plus swap in the warm smoke pairs. Use the accepted Mokly Cloud startup and ten-edit sessions for the two-percent acceptance bound. Do not repeat the waived local ten-edit matrix.
- [x] Push the implementation and send its SHA and dist build commit to the performance orchestrator at once. Obtain the Mokly Cloud measurements.
- [x] Confirm the Mokly Cloud plain-CSS goal: no equal-input base `no-record` spans, at least 0.15 seconds less base preparation, and at least 0.15 seconds earlier first Changes.

Evidence: `.context/shared-base-stylesheets/evidence/` holds the raw runs, byte comparisons, and before-and-after report.

The earlier 0.25-second base stylesheet figure comes from Mokly Cloud, which has no PostCSS. `examples/basic` runs its roots through Tailwind PostCSS. Its base records keep their physical key and are expected to miss.

## Milestone 5: Checks, review, and pull request

Depends on: 1, 2, 3, 4

- [x] Smoke-test the strict example through Serve. Save any browser screenshot under `.context/`.
- [x] Integrate later correctness fixes from the prerequisite owner before final verification and measurements. Keep their review and pull request with that owner.
- [x] Reconcile the final render README and public runtime comment with the combined source. Keep default-off watching and the independent origin.
- [x] Update the live source pointers that this change moves in inherited follow-up items. Preserve every outcome.
- [x] Integrate current `main` at `525b4d7e5` for final pull request preparation. Preserve its comparison channels, UI sizing, diagnostics, and session reads. Use that commit for the final local control.
- [x] After the correctness pull request merges, merge `origin/main` once with the `git-merge` skill. Preserve its additions before the confirming check.
- [x] Send the final combined SHA for the performance orchestrator's confirming check before the pull request. The initial Cloud result is accepted.
- [x] Obtain the final common-main confirmation, including startup memory and two cold ten-edit sessions per arm. Wait for it before opening this pull request.
- [x] Separate cache origin from the new Serve watch option. Prove non-watching heads, no-extraction bases, and expired original-head references.
- [x] Run targeted tests and each new asynchronous test ten times. Record test costs and assertion-failure proofs.
- [x] Run `cargo xtask check --suite repository` and the complete `cargo xtask check` gate. Use Git 2.45 or later, Git LFS, pinned Bun, and locked Cargo dependencies.
- [x] Merge current `origin/main` with the `git-merge` skill before the final pull request. It now holds step 2. Target the fix branch until its pull request merges, then target `main`.
- [x] Commit with Conventional Commits and push this branch. Send the implementation SHA to the performance orchestrator.
- [x] Review the complete local diff against the stacked base with the `implementation-review` skill after the push. Fix confirmed `fix now` findings, record follow-ups for the rest, and re-review. Use at most two fix rounds.
- [ ] Delete this plan when every earlier TODO is complete and the review rounds are done.
- [ ] Open the stacked pull request without merging. Preserve this plan's dated calls and permalink in its description. Watch the last commit's CI with the finish-work skill's `scripts/ci-wait.sh`. Send the complete report to the performance orchestrator.
