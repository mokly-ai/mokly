# Read captured base usage without document restore

Status: Active. On branch `calummoore/mokly-base-usage-without-restore-g972`, no pull request yet. The pull request that completes this work deletes this plan.

Mokly compares a pinned base catalogue with the current catalogue. Its workspace
projection adds caller-owned component input changes to public entry details.
The projection currently restores each base document only to read its usage.
The capture already retains that usage outside the compressed document payload.

The user authorised this plan and its implementation on 2026-11-16. The user
requires an open pull request into `main`, completed review rounds, and passing
CI. The performance orchestrator will merge the pull request. This workspace
must not merge it.

Contract owners:

- [Comparison serving](../docs/protocol/mokly-comparison-serving.md).
- [Changes controls](../docs/protocol/mokly-changes-controls.md).
- [Entry detail delivery](../docs/protocol/mokly-shell-delivery.md#entry-detail).
- [Component explorer](../docs/protocol/mokly-component-explorer.md).
- [Graph README](../crates/mokly-graph/README.md).
- [Comparison README](../crates/mokly-compare/README.md).

## Design and recorded calls

The performance orchestrator made these calls on 2026-11-16. The user asked it
to improve Changes speed and reliability without risking machine memory.
The user gave it the design decisions for these performance changes.

1. Add a comparison usage read to the render generation. Its default reads
   the comparison document. Captures read retained usage for kept views.
   Uncaptured views read their source. Every wrapper forwards the read.
   This returns the same value without restoring a kept document.
   Reject a second retained usage copy in each comparison result because
   it increases memory for every retained result.
2. Use that read in workspace input projection. Preserve its rules, errors,
   and input change order.
3. Keep document restore failure fallback unchanged. Captured metadata reads
   cannot fail and need no restore fallback.

The starting commit is `331bf5d43`. Inspection confirms these calls fit its
capture, codec, projection, and four product callers. The generation already
has scheduling methods. Preserve them. Check all generation implementations
again after each merge from `origin/main`.

The options check found one exception to the forwarding call. `FrozenResources`
checks document digests. Forwarding its usage read would skip that check for
uncaptured source reads. The workspace orchestrator's call of 2026-11-16 keeps
the document-based default for checking wrappers. Transparent wrappers forward.
Serve captures above `FrozenResources`, so kept workspace reads still restore
no document. This is the smallest change that also preserves source errors.

### 1. Read retained usage through generations

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-graph/src/types.rs` and `crates/mokly-compare/src/projection_inputs.rs`.
- **Terms:**
  - **Capture:** A bounded store of compressed view documents and retained metadata.
  - **Generation:** The shared reader for one catalogue's rendered views.
- **Background:** Workspace projection supplies component input changes in Serve and static output. Captures already retain the usage needed by that projection.
- **Problem:** Projection restores the full base document to read this metadata.
- **Impact if no action:** Each Ready publication and static projection repeats decompression and tree decoding.
- **Root question:** How can workspace projection read base usage without decoding captures while source reads keep their checks and errors?
- **Options:**
  - **A.** Add a generation usage read with a document-based default. Captures read retained metadata and wrappers forward it. Effort: Small.
  - **B.** Retain usage separately in the comparison result. This duplicates data for each retained result. Effort: Small.
  - **C.** Replace comparison documents with separately lazy metadata and tree handles across all consumers. This broadens the change. Effort: Medium.
  - **D.** Use A, but keep the document-based default for wrappers that add document checks. Transparent wrappers forward. Effort: Small.
- **Left out:** Change nothing fails the no-restore goal. A larger cache does not remove capture restores and adds memory pressure.
- **Wider fix:** D. The default preserves document checks. A missing optimisation override costs speed without losing validation.
- **Previous examples:** The capture already reads retained closures and stylesheet digests without restoring documents.
- **Recommendation:** D, in place of the original A. It preserves checked source reads without another retained usage copy.
- **Action:** fix now, apply D. The workspace orchestrator refined the forwarding call on 2026-11-16 to preserve digest errors.

Shared assumptions: projected details stay byte for byte equal, errors and order
stay equal, and captures keep their memory bounds. The task requires each one.
The three recorded calls above define option A. The checking-wrapper exception
defines D. No user decision remains open.

### 2. Preserve absent document metadata

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Code structure.
- **Location:** `crates/mokly-graph/src/types.rs` and `crates/mokly-graph/src/document_codec.rs`.
- **Background:** A graph artifact can have no composed document. The encoded view preserves that absence. Projection already requires a composed document for comparison view plans.
- **Problem:** The new usage boundary must preserve this state without inventing usage or a new error.
- **Impact if no action:** An unsuitable return type could change error behaviour or introduce a new panic in the graph.
- **Root question:** What return shape preserves absent document metadata and today's caller behaviour at the lowest cost?
- **Options:**
  - **A.** Return optional usage inside the existing result. Keep the current projection invariant at its caller. Effort: Small.
  - **B.** Return usage and add a typed error for absent metadata. This changes the existing invariant's failure behaviour. Effort: Small.
  - **C.** Split document and resource artifacts into separate types before adding the read. This changes many consumers. Effort: Large.
  - **D.** Return optional borrowed or owned usage through `Cow`. Captures avoid a usage clone but callers handle another type. Effort: Small.
  - **E.** Use A and replace the projection invariant with a typed comparison error. Other invariant reads keep their current shape. Effort: Small.
- **Left out:** Inventing empty usage hides absence and changes semantics. A new graph panic breaks the Rust rules.
- **Wider fix:** C. Separate types could make absent document metadata impossible for document consumers.
- **Previous examples:** `Artifact::document` and encoded metadata already use `Option`.
- **Recommendation:** A. It preserves the existing states with the smallest correct change.
- **Action:** fix now, apply A. This is the workspace orchestrator's call of 2026-11-16.

Shared assumptions: artifacts can lack metadata, and this change preserves that
state. Current code establishes the first fact. The task requires the second.
Use `Result<Option<CatalogueUsage>>` and a borrowed optional codec accessor,
as the options check recommends. Owned usage is an implementation choice, not
a task requirement. It gives defaults, captures, and mocks a simple signature.
Reconsider D only if measurements identify this clone as material work.

The fresh options check confirmed item 2's A and changed item 1 from A to D.
Its full report is `.context/base-usage-without-restore/options-check.md`.

Implementation calls of 2026-11-16: reuse the existing projection fixture
helpers within the test crate to avoid duplicate setup. Use the task-approved
counter restorer because an unused Unimock restorer rejects zero calls.
Both calls preserve the required result and operation-count assertions.

## Replaced ways

- Workspace input projection restores base documents to obtain usage. Move its
  sole reader to the generation usage read in Milestone 2. Remove that restore
  from this path in the same milestone. Keep document reads for consumers that
  need document bytes or trees. They remain live functionality.
- Product callers share `projection_workspace::apply`: Serve change details,
  Serve comparison metadata, static comparison details, and static comparison
  output. Each receives the new path through that shared projection.
- No converter or second retained usage store remains.

## Milestone 1: Documentation boundary

Depends on: none

Completed: 2026-11-16.

The docs implementor checks the contracts and documents the new graph boundary.
This change preserves public requirements and needs no mockup work.

- [x] Check the serving and Changes contracts against the recorded calls.
- [x] Update graph and comparison README entry points for retained usage reads.
      Keep requirements unchanged and keep implementation mechanics out of protocol docs.
- [x] Record the separate removed-entry usage-only render path as a follow-up.
      Its source read has different validation, so this change does not move it.

Evidence belongs in `.context/base-usage-without-restore/docs-report.md`.

## Milestone 2: Usage read and regression coverage

Depends on: 1

Completed: 2026-11-17.

The non-ui implementor adds the read and moves workspace projection to it.

- [x] Add the default comparison usage read and retained codec metadata accessor.
- [x] Read captured usage without calling the document restorer. Read uncaptured
      usage from the source. Forward through transparent wrappers. Keep the
      checked default for wrappers that add document checks.
- [x] Replace the workspace projection document read. Preserve filtering,
      counterpart rules, errors, literal input values, and input change order.
- [x] Cover changed entry-owned component inputs through a capture with literal
      expected input changes. Retain all existing projection assertions.
- [x] Prove red first that workspace projection over a captured base restores
      zero documents, with a restorer double or restore counter.
- [x] Cover source fallback for an uncaptured view. Prove each new behavioural
      test fails on an assertion before its implementation.
- [x] Cover a usage read through `FrozenResources` that rejects changed document
      bytes with its existing error. Preserve the check on uncaptured reads.
- [x] Run targeted graph, comparison, and wrapper tests, Rust formatting, and
      Clippy. Record test cost and red/green results.

Evidence belongs in `.context/base-usage-without-restore/implementation-report.md`.

## Milestone 3: Release measurements and output proof

Depends on: 2

The non-ui implementor measures release binaries of the latest merged main and
the branch. Save both binaries before moving build inputs. Run builds serially.

- [ ] Record the exact main and branch revisions, environment, fixture sizes,
      edit, sidecar count, and command arguments.
- [ ] Check `df -h` and `free -m` before each large Cargo build. Set
      `CARGO_INCREMENTAL=0`. Run only one Cargo build at a time.
- [ ] Measure Serve with one edit on `examples/basic` and the HTML and React
      large fixtures from `scripts/large/`. Record Ready publication duration,
      or `changes.classify` duration through ready state.
- [ ] Measure `mokly build` with Changes on those same fixtures and revisions.
- [ ] Compare projected detail bytes before and after with identical catalogue
      inputs. Save this one-time proof outside permanent tests.
- [ ] Save raw evidence and a before/after table under
      `.context/base-usage-without-restore/`. Use bounded harness memory and
      report noise and each unavailable measurement.

Integration record of 2026-11-17: the user instructed this workspace to keep
main's scheduling and Git process changes, then its CLI allocator change.
The usage override now lives in `capture_generation.rs` beside the scheduling
methods. Checking wrappers still use the document-based default.
The release baseline is `6d0fcbb46`. Verification uses Git 2.45.4 first on `PATH`.
This applies the existing design without another design choice.

## Milestone 4: Gate, review, and pull request

Depends on: 1, 2, 3

The workspace orchestrator checks every delegated result and owns this work.

- [x] Fetch and merge `origin/main` with the git-merge skill before delegation
      batches and the final pull request when main has advanced. Preserve both
      scheduling and usage reads. Forward through each new transparent wrapper
      and preserve document checks in each checking wrapper.
- [ ] Run targeted tests, `cargo xtask check --suite repository`, and the
      complete `cargo xtask check` gate. Record every failed or blocked suite.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      implementation-review skill after the push. Check every new finding.
      Apply at most two fix rounds. Record deferred and open follow-up items.
      Re-review once and record the final result.
- [ ] Prepare the final report with the commit, measurements, design calls,
      review outcomes, follow-up items, and checks. Send it to the performance
      orchestrator after the pull request opens and its CI completes.
- [ ] Delete this plan under the plans skill. Preserve its dated calls and a
      permalink in the pull request description.
- [ ] Open the pull request into `main`. Run the finish-work CI wait script after
      each push and pull request creation. Fix branch-caused failures. Rerun an
      unrelated failure once and record it. Leave the pull request open.

Merge evidence belongs in `.context/base-usage-without-restore/merge-integration-report.md`,
`scheduling-merge-audit.log`, and `allocator-merge-audit.log`.
