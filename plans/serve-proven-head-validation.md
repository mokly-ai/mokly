# Proven head validation for Serve edits

Status: Active. On branch `calummoore/mokly-edit-comparison-cost-bo07`, no pull request yet. The pull request that completes the work deletes this plan.

Serve repeats head validation before it checks whether the previous view
comparisons remain valid. The measured largest part is the validation of each
view's resource closure. This change targets that work. It keeps the exact
published output and the complete content proof.

The performance orchestrator owns official measurements and every merge.
Acceptance needs at least 60 ms less mean warm edit time on `mokly-cloud`.
Basic and the large React fixture must not regress beyond noise. The whole-tree
peak of cold ten-edit sessions must stay within 2% of `main`.

Contract owners:

- [Changes serving](../docs/protocol/mokly-changes-serving.md).
- [Comparison serving](../docs/protocol/mokly-comparison-serving.md).
- [Comparison contract](../docs/protocol/mokly-comparison.md).
- [Graph README](../crates/mokly-graph/README.md).
- [Comparison README](../crates/mokly-compare/README.md).

Investigation evidence and the delegate ledger live under
`.context/edit-comparison-cost/`. The investigation implements option B of
[the earlier follow-up](./follow-ups/mokly-cloud-edit-comparison-cost.md).
The temporary probe stays outside the product diff.

## Design

Design call on 2026-11-21: apply F under the user's instruction to design and
implement this change while keeping the existing rules. A fresh Claude Opus
max options check recommended F instead of the initial D. It found no required
protocol change. Its report is saved at
`.context/serve-proven-head-validation/options-check.md`.

The measured split used `beb87a53a`. Before product code, this branch integrated
`origin/main` at `793d0c77d`. Final comparisons use that newer main and own
rebuilt core and distributions. The earlier measurements identify the target
phase. They are not acceptance evidence for the implementation.

User decision on 2026-11-21: the performance orchestrator approved F. It requires
one recorder mutation check for each input class, red tests for both identified
traps, local edit and fact-peak measurements on both default large fixtures,
the lasting React fresh-process differential, and follow-ups for kept-base
freshness and Ready publication. A large-fixture slowdown must be reported
before the implementation push.

User decision on 2026-11-21: frozen main confirmed that an unchanged ServeEdit
salt can change `comparisonUrl` across processes while its named content stays
equal. Keep product identity unchanged. The Serve oracle checks the raw root's
stability and its stage transition pattern within each process against main.
Across processes, it compares all named content through an explicit root map.
It retains raw roots and keeps detail IDs, snapshot IDs, and base commits exact.
Static output still has no substitutions. Record the salt and its restart-cache
effects as a separate follow-up.

### 1. Avoid repeated head closure validation

- **Severity:** Low. **Effort:** Large.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-compare/src/comparison.rs`,
  `crates/mokly-compare/src/reuse_reads.rs`, and
  `crates/mokly-graph/src/evaluation.rs`, the graph closure walk, and the
  generation wrappers that include `FrozenResources`.
- **Terms:**
  - **Content proof:** Equality of every input that a saved view result reads,
    checked by a content digest or an exact value.
  - **Validation facts:** A view's closure files, ordered closure warnings,
    lexical observer paths, and complete walk read identities.
  - **Current usage:** The current document's component instances, slots, and
    ranges, read for the current classification.
- **Background:** Serve validates every head view before its comparison stream.
  It then proves each reused comparison and reads current usage. The resource
  closure work of the first pass remains large after comparison reuse.
- **Problem:** The head validation pass repeats resource walks for views whose
  complete inputs remain equal. Sharing ordinary identities already works.
- **Impact if no action:** Warm React edits keep the repeated validation cost.
  A smaller proof-only change can miss the required improvement.
- **Root question:** How can a warm edit reach published Changes sooner while
  keeping output, diagnostics, watch inputs, current usage, complete proof,
  and fixed memory bounds exact?
- **Options:**
  - **A.** Reduce identity-table overhead or compare digests of complete read
    sets. Backend identity reads already share work. Head validation remains.
    Effort: Medium.
  - **B.** Retain previous usage after an exact proof of its inputs. This adds
    retained data and needs approval to change the rule that comparisons keep
    no usage. Usage cloning is a small part of the measured cost. Effort: Medium.
  - **C.** Read current document metadata and proof from the render cache without
    restoring full trees. Keep current checks and exact identities. This targets
    document reads in the stream and needs cache accounting work. Effort: Medium.
  - **D.** Reuse exact head validation facts after a complete current content
    proof. Keep current usage in this attempt's working set. Rerun the ordered
    validation summary and all global checks. This targets the largest measured
    phase. Its proof, error order, and charges need focused review. Effort: Medium.
  - **E.** Make every current closure walk cheaper without reusing validation
    facts. Share or precompute reference scans and reduce traversal allocations.
    This avoids new validation retention but changes more graph mechanics.
    Effort: Large.
  - **F.** Record a complete read set at the validation walk. Reuse only its
    closure facts after current proof. Key them by head route and document
    identity, independently of pairing. Replay observer effects. Read anchors,
    links, document warnings and usage from the current checked document.
    Pass that proof to the stream. Drop optional facts before comparisons.
    Effort: Large.
  - **H.** Start head validation beside base pinning and the kept-base check.
    Keep failure order when joining. This adds scheduling and cancellation
    work, and it does not remove work. Its estimated gain alone misses the
    required improvement. Effort: Medium.
- **Left out:** Change nothing fails the speed goal. Watcher events and edited
  file lists cannot prove content equality. Entry or catalogue result reuse
  omits required aggregate passes. Larger memory bounds violate the task.
  Lazy observer hashing targets negligible work on this fixture. G, a separate
  generation-leased store, exceeds the existing bound. Disk facts conflict with
  the Serve-only memory rule. Skipping or delaying validation changes failures.
- **Assumptions:** The task keeps the content proof, current usage, aggregate
  passes, and memory bounds. The protocol keeps warning and failure order.
  No option may replace these with file events or a partial read set.
- **Wider fix:** F. Recording identities where validation reads them keeps the
  proof complete when the walk's input layout changes.
- **Previous examples:** The earlier comparison-cost follow-up requires this
  split before choosing an optimization. Existing comparison reuse records
  complete read sets and rejects unknown, changed, or unavailable inputs.
- **Recommendation:** F, changed from the initial D after the options check.
  F covers validation inputs that comparison evidence omits. It also avoids
  pairing-dependent lookup and preserves watch effects. E remains an alternative
  if F cannot satisfy retention and diagnostic order.
- **Action:** Apply F, approved by the performance orchestrator on 2026-11-21
  with the conditions above. Ask only if a real protocol change becomes
  necessary.

### Required design properties

- Record every validation input at its read boundary. Include public policy,
  visited static targets, ignored and unavailable targets, generated resources,
  membership, absence, and the checked document. Comparison reads alone do not
  cover an unavailable target reached only by ignored references.
- Compare the head document key and policy identity before a checked read.
  A changed document key causes ordinary validation without an extra proof read.
- Key facts by head route and document identity, without pairing. Keep head
  validation before pairing and the stream. An unchanged settings fence is
  required. A conservative base fence may also force ordinary validation.
- Read the current checked document for anchors, links, document warnings and
  exact current usage. Keep only closure files, closure warnings in walk order
  with duplicates, observed lexical paths, and shared read pointers in facts.
- Pass the current document identity and usage to the stream. A reused view
  must not make a second checked head read. Retain no prior usage in saved
  comparisons. Current usage remains this classification's working data.
- Replay every closure observer call on reuse. Rebuild recipe resource inputs
  and the generation's observed watch set, and notify the watcher. Preserve
  targets after an entry is removed and restored before acceptance.
- Retain no document, tree, resource bytes, generation, capture, or lease in
  validation facts. Charge all kept, staged, shared, and draining allocations
  to the existing fixed 32 MiB comparison bound. Do not treat transient current
  usage as kept data. Optional facts never displace comparisons. Drop facts
  first when space is tight. Comparisons may remain complete without facts.
- A proof miss performs ordinary full validation and comparison as needed.
  A failed proof read causes only a miss. It does not add a failure diagnostic.
- Preserve every existing comparison fence: configuration, settings, selected
  base, base commit, catalogue, entry, route, and moves. Base comparison proofs
  remain source-free. A head-fact key does not replace a comparison fence.
- Run the ordered validation summary over every current view. Preserve its
  complete failures and warning order. Recheck logical links and resource
  namespace collisions across all views.
- Run every comparison step that combines views or entries again. Supply the
  exact current usage of both sides. Never reuse a final entry or catalogue.
- Accept facts only with the successfully published classification. Preserve
  cancellation, failure, replacement, overflow, and all-or-none comparison
  admission. Facts are optional and do not share that all-or-none requirement.
- If these properties need a protocol change, send its exact recommendation
  to the performance orchestrator before dependent work.

## Milestone 1: Contract and plan

Depends on: none

- [x] Read the repository rules, skills, protocol owners, and existing reuse.
- [x] Split the cloud critical path with an ignored temporary probe.
- [x] Save the final split and setup recipe under `.context/edit-comparison-cost/`.
- [x] Run a fresh Claude Opus max options check and merge its result here.
- [x] Send the split, ranked options, and any protocol decision to the orchestrator.
- [x] Record the authorized design call and confirm that the contracts cover it.
- [x] Validate this Markdown, commit the plan alone, and push it.

## Milestone 2: Red correctness tests

Depends on: 1

- [x] Add an assertion-failing test for each new validation or proof reuse path.
- [x] Use real graph validation through `FrozenResources` and
      `MemoryComparisons` for the lasting fact-reuse oracle. The existing
      server oracle mocks whole-head validation and cannot cover this path.
- [x] Cover a changed input of a reused view that forces ordinary validation
      and comparison again. Include missing and unavailable proof inputs.
- [x] Cover ignored unavailable targets, observer replay after unaccepted
      removal/restoration, changed destination anchors, cross-view namespace
      collisions, and unnormalized failure warning order.
- [x] Add a real React differential sequence against a fresh-process full
      comparison: text, class, new import, removed component, renamed export,
      and a base change. Compare exact Changes output, warnings, and diagnostics.
- [x] Prove the differential assertions can fail before implementation. Keep
      red logs and mutation evidence outside the repository. Once the new path
      exists, mutate it to prove that the assertions catch incorrect reuse.
- [x] Keep the real React fresh-process differential as a lasting test because
      the user explicitly requested it. This task overrides the shared skill's
      general rule against lasting one-time equivalence proofs.
- [x] Protect global link and namespace checks, first diagnostic and warning
      order, current usage, fences, admission, overflow, and draining charges.
- [x] Count closure walks and checked document reads. Prove no repeated walk
      or second checked read on reuse, and no proof read on a changed key.
- [x] For each input class, remove that class from the recorder in a test
      build and observe an assertion failure. Restore each mutation and keep
      its exact evidence under `.context/`.
- [x] Cover a base-reference-only refresh on the same head generation and
      pressure where comparisons fit but optional facts do not.

Evidence: `.context/edit-comparison-cost/implementation/evidence-map.md`.

## Milestone 3: Complete proof with less repeated work

Depends on: 2

- [x] Implement the chosen approach with the required properties above.
- [x] Remove the repeated work that the new path replaces. Keep every existing
      check and assertion. Add no timeout, retry, or sleep.
- [x] Update crate README entry points when the implementation adds a useful
      boundary. Keep the protocol unchanged unless an approved decision needs it.
- [x] Run the targeted tests and record every red-to-green result.
- [x] Run each new asynchronous test ten times. Record its cost and pass count.

Evidence: `.context/edit-comparison-cost/implementation/ten-runs-summary.json` and
`.context/edit-comparison-cost/implementation/implementation-report.md`.

## Milestone 4: Local acceptance evidence

Depends on: 3

- [ ] Freeze own release main and candidate cores and distributions with exact
      source, build, environment, and artifact provenance.
- [ ] Measure interleaved warm cloud edits against current `origin/main`.
- [ ] Check warm Basic edits for regression. Measure edit time and peak fact
      bytes on both default large React and large HTML. Compare kept bytes
      with and without facts. Report any large-fixture slowdown before pushing.
- [ ] Compare complete strict build artifacts with Changes enabled on cloud,
      Basic, default large HTML, and default large React. Compare actual bytes.
- [ ] Compare Serve Changes fields, counts, published details and comparison
      documents, warnings, and diagnostics against main after each sequence step.
- [ ] Keep document, all published stylesheet, and asset body guards from the
      transferred proof helpers. Preserve exact sources, indexes, and runtimes.
- [ ] Run targeted tests, `cargo xtask check --suite repository`, and the full
      `cargo xtask check`. Record every failed or blocked check without a skip.

## Milestone 5: Official acceptance, review, and pull request

Depends on: 4

- [ ] Fetch and merge new `origin/main` with the `git-merge` skill when needed.
      Keep this workspace branch. Never rebase a pushed branch.
- [ ] Commit with Conventional Commits and push. Send the SHA and local evidence
      to the performance orchestrator for official warm and cold-memory checks.
- [ ] Obtain official acceptance of the speed, regression, and memory criteria.
- [ ] Review the complete pushed diff against `origin/main` with the
      `implementation-review` skill. Run finding checks and the permitted fix
      rounds. Record all results in the branch findings file.
- [ ] Resolve the addressed comparison-cost follow-up and record every remaining
      review item through the shared skill rules.
- [x] Record kept-base freshness and Ready publication as separate follow-ups
      with the measured split. List them in the pull request.
- [x] Record the existing random ServeEdit salt and its effect on cache reuse
      across restarts as a separate follow-up. Keep product identity unchanged.
- [ ] Delete this plan when the `plans` skill permits it.
- [ ] Open the pull request into `main`. Preserve this plan's dated decisions
      and permalink in its description. Watch final CI with the skill's
      `scripts/ci-wait.sh`. Fix branch failures. Record Site Lighthouse as
      unrelated and do not rerun it. Report the PR and SHA. Do not merge.
