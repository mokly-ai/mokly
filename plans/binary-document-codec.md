# Binary compact document codec

Status: Active. On branch `calummoore/mokly-binary-document-codec-967l`, no pull request exists yet. The completing pull request deletes this plan.

Mokly keeps rendered documents in a bounded compact cache and comparison capture.
Their private codec compresses document bytes and a JSON tree with zlib.
Restore spends most of its CPU time inflating and parsing that tree.
Replace the private tree representation with a compact binary serde format.
Keep document output, metadata, cache bounds, and error fallback unchanged.

The user authorized planning, implementation, review, and an open pull request on 2026-11-17.
The performance orchestrator owns the design calls below, dated 2026-11-17.
The authority is the user's 2026-11-16 instruction to improve Changes speed and reliability without exhausting machine memory.
The user gave these design choices to the performance orchestrator.
This workspace must not merge the pull request.

Contract owners:

- [Runtime cache](../docs/protocol/mokly-runtime.md#render-graph-and-cache).
- [Comparison capture](../docs/protocol/mokly-comparison-serving.md#base-and-head-capture).
- [Graph integration](../crates/mokly-graph/README.md).
- [Comparison integration](../crates/mokly-compare/README.md).

Replaced ways:

- JSON `Payload` serialization becomes binary serde serialization in Milestone 2.
  Consumers are `EncodedView::encode`, `encode_pooled`, `restore`, and the invalid-tree codec test fixture.
  Move each consumer and remove the JSON codec error adapter in Milestone 2.
  Keep other JSON uses that serve separate boundaries.
- Direct `SourceLocation` serialization becomes a private source record in Milestone 2.
  Its consumers are `FlatNode::Element`, flattening, and tree restoration.
  No stored file or external consumer requires a converter or migration.

## Design and calls

The payload remains private to the process.
The document byte prefix, separate Rust metadata, iterative flat tree, and bounded cache ownership stay in place.
Audit every nested serialized type before selecting the binary format.
Keep `flate2`, its backend, and `Compression::fast()` unchanged.
Do not add an unbounded inflate buffer or an unchecked allocation from a decoded length.
Record the serialized tree length at encode time and use it to bound decoding.
After decoding, require the end of the inflated stream and validate its checksum.
Temporary experiments and benchmark tools live under `.context/binary-document-codec/`.
Only the selected dependency remains in the implementation.

### 1. Reduce compact restore CPU

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-graph/src/document_codec.rs`.
- **Terms:** `EncodedView` is the compact document shared by the cache and comparison capture.
- **Background:** The supplied profile puts 14.6% of core samples in compact restore. JSON decode and its inflate dominate that work.
- **Problem:** Repeated compact reads consume substantial CPU during Changes.
- **Impact if no action:** Changes keeps paying the current restore cost.
- **Root question:** How can compact document reads use at most half the restore CPU without increasing compressed size?
- **Options:**
  - **A.** Measure compact serde candidates, including postcard and bincode, then select the qualifying winner. Effort: Medium.
  - **B.** Build a custom binary tree codec. This adds maintenance and validation work. Effort: Large.
  - **C.** Apply A and encode common namespaces with short codes plus an exact-string fallback. Measure the extra record logic. Effort: Medium.
  - **D.** Apply A and construct the tree during record decoding. This removes the intermediate record vector but changes restoration. Effort: Medium.
- **Left out:** Buffered JSON alone misses the supplied CPU goal. Uncompressed trees break the size requirement. Changing compression breaks the fixed-backend constraint.
- **Wider fix:** None. Performance is a measured result. Item 2 owns record isolation.
- **Previous examples:** Existing attribute, reference, and region codec records in `document_annotations.rs`.
- **Recommendation:** A. Choose by measured restore CPU and compressed size on real documents.
- **Action:** Apply A. Performance orchestrator's call of 2026-11-17 under the authority above.

Options check, 2026-11-17: recommendation A kept. C and D remain measured fallback approaches if A misses the target.

Shared assumptions: exact restored fields and no payload growth come from the task.
Binary serde and unchanged compression come from the performance orchestrator's call.
The codec is private and has no migration consumer, as the current callers and task establish.

### 2. Preserve optional trusted annotations

- **Severity:** High. **Likelihood:** Common. **Effort:** Small.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `crates/mokly-graph/src/document_nodes.rs`.
- **Terms:** `SourceLocation` records an authored path, coordinates, and optional export name.
- **Background:** The flat tree directly serializes `SourceLocation`. Its JSON rules omit an absent export field.
- **Problem:** Non-self-describing decoders cannot recover a field omitted by JSON serialization rules.
- **Impact if no action:** A binary restore can fail or change annotations.
- **Root question:** How does each trusted annotation survive exactly, regardless of its public type's serde rules?
- **Options:**
  - **A.** Add private records for each incompatible nested serde type. Effort: Small.
  - **B.** Give public types conditional binary serde implementations. This couples public models to the private codec. Effort: Medium.
  - **C.** Mirror every nested public type with a private record, regardless of its current serde rules. Effort: Small.
- **Left out:** Keeping omitted fields in a binary record fails decoding. Serializing nested JSON retains parse work and a second representation.
- **Wider fix:** C. The record boundary cannot inherit a public JSON rule.
- **Previous examples:** Attribute and reference records isolate public types. The region record still nests a public owner type.
- **Recommendation:** C, after the options check. The initial recommendation was A. Both add the same two private records today.
- **Action:** Apply C. This workspace's call of 2026-11-17 implements the performance orchestrator's call A with structural record isolation.

Shared assumptions: every annotation must survive, as the runtime contract and task require.
Private records are an implementation choice already used by the codec.
The nested-type audit must check omission, unknown-field, untagged, and tagged-enum serde rules.

This workspace's reason for C is structural isolation from public JSON rules, at the same current implementation cost.
`ComponentInputOwner` needs a record because its custom decoder reads JSON maps.
The existing region record still holds that public owner type and therefore does not complete this boundary.

### 3. Keep lossless restore and fallback

- **Severity:** High. **Likelihood:** Common. **Effort:** Small.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `crates/mokly-graph/src/document_error.rs`.
- **Terms:** `Artifact` holds response bytes, a document, a fragment, and the content type.
- **Background:** Cache restore failures drop the compact entry. Capture restore failures read the original source.
- **Problem:** A format change can accidentally alter restored fields or bypass these fallback paths.
- **Impact if no action:** Changes can show incorrect output or lose its recovery path.
- **Root question:** How can faster restore keep the current document and recovery contract?
- **Options:**
  - **A.** Preserve all current artifact fields and map binary failures into the existing codec error boundary. Effort: Small.
  - **B.** Apply A and require an empty final read from the inflated stream. This checks trailing data and the zlib checksum. Effort: Small.
  - **C.** Apply B and retain the serialized tree length as a trusted decode bound. Charge its storage to the view. Effort: Medium.
- **Left out:** Partial records change output. Panics and swallowed errors break fallback. A decode after every encode adds unnecessary CPU work.
- **Wider fix:** C. One private decode step owns both length bounds and stream completion.
- **Previous examples:** Existing damaged-payload, cache restore-failure, and capture fallback tests.
- **Recommendation:** C, after the options check. The initial recommendation was A. C also prevents allocation from an unchecked damaged length.
- **Action:** Apply C. This workspace's call of 2026-11-17 implements the performance orchestrator's call A with bounded complete decoding.

Shared assumptions: output equality and decode-error fallback are requirements from the task and linked contracts.
This workspace's reason for C is the task's memory constraint and its corrupt-payload requirement.
The serialized tree length costs one charged integer per view and comes from encoding, not decoded input.

Options-check evidence: `.context/binary-document-codec/plan-options.md`.

## Milestone 1: Documentation and contract audit

Depends on: none

Delegate this audit to the `docs implementor`.
This private format change is expected to need no protocol change.

- [x] Check the cache and capture contracts against all three calls and the current implementation.
- [x] Update only documentation that contradicts the intended boundary behaviour.
      Record a no-change result when the existing requirements remain sufficient.

Milestone completed: no boundary doc contradicts the private change.
No protocol, format inventory, migration, or README entry-point edit is needed.

Evidence: `.context/binary-document-codec/docs-audit.md`.

## Milestone 2: Measure and implement binary payloads

Depends on: 1

Delegate this domain to the `non-ui implementor`.
Keep Cargo builds serial, use `CARGO_INCREMENTAL=0`, and check disk and memory before each large build.
Use a separate checkout and target directory for release baseline and branch builds.

- [ ] Measure the last merged `origin/main` in its own checkout and release target directory.
- [ ] Compare postcard and bincode with real example and generated large documents. Record restore CPU and compressed bytes.
- [ ] Select the qualifying format and record its dated design call, reason, and options check.
      If no candidate qualifies, measure C or D of item 1 before changing scope. Ask the performance orchestrator for a scope decision if needed.
- [ ] Audit all nested serde types. Add private records for incompatible types, including `SourceLocation`.
- [ ] Replace every private JSON payload consumer and its typed error adapter. Keep zlib settings unchanged.
- [ ] Bound decoded lengths by trusted encode-time tree length and require complete stream validation without unchecked allocation.
- [ ] Extend round-trip coverage across every node kind and optional field, including export present and absent.
      Verify every restored field and preserve all existing assertions.
- [ ] Verify corrupt and truncated payloads return typed codec errors. See new behaviour fail before its fix.
- [ ] Run existing codec, cache, and capture tests unchanged except the format-specific invalid-tree fixture writer.
- [ ] Measure branch release restore CPU, compressed bytes, and `mokly build` with Changes on the same inputs.
      Confirm exact output equality as a one-time proof.

Evidence: `.context/binary-document-codec/implementation.md` and `.context/binary-document-codec/measurements.md`.

## Milestone 3: Verification, commit, review, and pull request

Depends on: 1, 2

The orchestrator owns the gate, review, and pull request.

- [ ] Check the delegated work against every TODO and repository rule.
- [ ] Use Git 2.45 or later first on `PATH` and install `git-lfs` before the gate.
- [ ] Run targeted tests, `cargo xtask check --suite repository`, and `cargo xtask check`.
      Report each suite that cannot run and its blocker.
- [ ] Commit with Conventional Commits and push. Send the implementation SHA to the performance orchestrator immediately.
- [ ] Review the complete diff against `origin/main` with `implementation-review` after the push.
      Check each new finding, apply its outcome, and complete the permitted two fix rounds.
      Record follow-up items for deferred, open, and outside-scope findings.
- [ ] Obtain the performance orchestrator's `mokly-cloud` result. Confirm restore CPU is at most half and payload bytes do not grow.
- [ ] Preserve nearby work if it merges first. Merge `origin/main` with `git-merge` and keep the usage accessor.
- [ ] Delete this plan after the other milestone TODOs pass and the review rounds finish.
- [ ] Open the pull request into `main`. Keep the dated calls, plan permalink, measurements, review outcomes, and follow-ups in its description.
      Watch the last commit's CI with the shared `scripts/ci-wait.sh`. Report to the performance orchestrator. Do not merge.

Evidence: `.context/reviews/calummoore/mokly-binary-document-codec-967l/findings.md` and `.context/binary-document-codec/checks.md`.
