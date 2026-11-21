# Reuse render keys after Serve edits

Status: Active. On branch `calummoore/mokly-incremental-render-keys-38ts`, no pull request yet. The completing pull request deletes this plan.

Serve computes every exporter key after each edit. Reuse the previous key when every input of that key remains equal. Keep the existing key format, published bytes, protocol, and render store identity. The user authorized this scope and autonomous design calls on 2026-11-20. The parent performance orchestrator owns cloud measurements and every merge.

User steering, 2026-11-20: keep `3e09c6150` as the frozen base for the gate, byte proof, and parent measurement. Do not rebase. After the parent accepts the Cloud result, merge `origin/main` once and rerun the gate. Repeat the byte proof only if that merge changes graph render-key or closure code. Then open the pull request. The user authorized this one branch integration. The parent still owns the pull request merge.

Contract owners:

- [Watched catalogue development](../docs/protocol/mokly-watch.md#invalidation-through-the-render-graph).
- [Rendering](../docs/protocol/mokly-rendering.md).
- [Render graph crate](../crates/mokly-graph/README.md).
- [Render adapter crate](../crates/mokly-render/README.md).

## Design

### 1. Reuse only keys with equal inputs

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-graph/src/render_inputs.rs`.
- **Terms:**
  - **Exporter:** A module with a resolved binding and its own render key.
  - **Closure:** A module and every module reached through its imports.
- **Background:** Each key hashes module records, resolution records, bindings, and shared inputs. Renderer or preview closures also enter the key.
- **Problem:** A small edit computes all exporter closures and keys again. The parent measured 89 to 118 milliseconds in this stage.
- **Impact if no action:** Serve keeps this work on its edit path.
- **Root question:** How can Serve avoid computing keys whose inputs remain equal?
- **Options:**
  - **A.** Compare compact per-module facts, then walk reverse imports from changed modules. Recompute affected exporters. Effort: Medium.
  - **B.** Compute each exporter's closure fingerprint, then reuse equal keys. This retains most closure collection work. Effort: Medium.
  - **C.** Retain each exporter's full closure membership and compare changed facts against it. This uses more retained memory. Effort: Medium.
  - **D.** Compute closure fingerprints over strongly connected graph components. This retains fewer facts but adds a component algorithm. Effort: Medium.
  - **E.** Use A with a strong runtime holder. This keeps reuse after a failed candidate but retains facts beyond generation release. Effort: Medium.
  - **F.** Compare raw predecessor inputs in the render adapter. This hashes fewer inputs but duplicates the key-input rules. Effort: Large.
- **Left out:** Watch events alone cannot prove complete input equality. Full computation alone does not implement the requested reuse. Sidecar change reports need a protocol change.
- **Wider fix:** A. Facts derive from the records that the full algorithm uses.
- **Previous examples:** The current full algorithm has reference-key and worker-order equivalence tests.
- **Recommendation:** A. One current-graph reverse walk avoids repeated exporter closure work and retains no closure memberships.
- **Action:** fix now, apply A. This is the orchestrator's design call, dated 2026-11-20, within the user's design calls.

Shared assumptions come from the task: exact keys, small retained memory, no protocol change, and full startup and base calculations. The watch protocol defines key inputs. All options keep these requirements.

For option A, compute a fact for each module record, its attributed bindings, and its resolution-chain records. Include missing imported modules. Compare facts with the previous generation. A changed ordered import list changes its source fact. A removed edge therefore invalidates its importer even though the new reverse graph lacks that edge. A missing or moved module changes its own fact or an importer's fact. Walk reverse imports in the current graph from changed facts. Recompute each reached exporter and every new exporter.

The fresh options check on 2026-11-20 kept recommendation A. Keep each fact at 256 bits. Identify each common closure by its selected root and exact records. Build the new key map from current eligible exporters only. Never patch a copy of the previous map. Keep edit comparison and walk work inside `render.inputs`. Decision 2 places startup fact preparation after Changes completion. Measure an edit inside the renderer closure as well as an isolated exporter edit.

Create the shared weak-pointer cell only in the Serve-head runtime builder. All per-attempt runtime copies share that cell. Build facts only when this cell exists. Pass previous keys only in `ServeEdit` capture mode. Startup rechecks stay full and unseeded until the adopted generation completes Changes. Use fixed-seed generated edits and fixed cases without a new property-test dependency. Accept a full calculation after a failed candidate loses its weak predecessor.

Compare the shared digest separately. A changed shared digest invalidates every exporter. Compare the renderer and preview closure identities once, and track each exporter's render mode. Recompute affected common-mode exporters. Missing renderer and preview cases retain the current fallback rules. Never reuse a fallback from the previous generation. Serialization failure retains the whole-bundle fallback and supplies no reusable facts.

Keep facts with `RenderKeys`. Keep one weak pointer to the latest keys in the Serve-head runtime. Base runtimes have no pointer. Enable reuse only for Serve head edits. Startup calculates every key without seeding facts. Decision 2 supplies the later seed. Base and non-Serve calls stay full calculations. Facts own no prior generation, module graph, catalogue, sidecar lease, or reverse index. Releasing a generation releases its facts. A missing or unseeded weak predecessor means a full calculation. Keep changes outside graph key modules small, especially `session.rs`, `types.rs`, and `lib.rs`.

### 2. Defer startup facts until Changes completes

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-graph/src/render_inputs.rs` and the Serve Changes completion path.
- **Terms:**
  - **Seed:** Prepare the compact facts that permit a later edit to reuse keys.
- **Background:** The first candidate calculates full startup keys and their reuse facts before Serve readiness. The parent measured a repeatable readiness cost.
- **Problem:** Startup pays for facts before an edit can use them.
- **Impact if no action:** Serve readiness retains the measured cost.
- **Root question:** How can Serve preserve edit reuse without a slower startup?
- **Options:**
  - **A.** Seed on the first edit. Startup avoids facts, but the first edit loses its reuse saving. Effort: Small.
  - **B.** Seed from existing generation metadata after Changes publishes and terminal completion returns. Retain only generation-owned facts. Effort: Medium.
  - **C.** Keep eager module facts and replace common hashes with root-based reverse invalidation. Remaining startup work still needs measurement. Effort: Small.
  - **D.** Keep the first candidate unchanged. The parent now permits a recorded readiness cost if edit gains remain. Effort: Small.
  - **E.** Cache directory-chain digests within each fact build. This changes the fact algorithm and needs new measurement. Effort: Medium.
  - **F.** Schedule the fact pass on existing workers. This adds scheduling work and needs new measurement. Effort: Medium.
  - **G.** Read predecessor facts lazily on the first edit through weak metadata. The edit pays the extra predecessor pass. Effort: Medium.
- **Left out:** Detached tasks lack shutdown ownership. Retained catalogue copies or per-exporter closures add unnecessary memory. Removing reuse fails the task.
- **Wider fix:** B. The lifecycle places optional reuse preparation after accepted completion and outside publication locks.
- **Previous examples:** The first candidate already keeps generation-owned facts without a strong runtime holder.
- **Recommendation:** B. The user explicitly chose post-completion seeding on 2026-11-21.
- **Action:** fix now, apply B. This is the user's decision and supersedes eager startup seeding in the earlier design.

The parent repeated six warm unchanged rounds with snapshot-agent overlap controlled. The first-Changes regression did not reproduce. Serve readiness remained slower. The parent chose B and authorized a new candidate after targeted tests and both proofs. It will accept a remaining readiness cost if the edit gain holds, with that cost recorded in the pull request. The fresh options check kept B. Options E and F are not part of this implementation.

Startup and rechecks use a direct full computation with an empty generation-owned lazy fact cell. Base and ordinary full builders keep no cell. A post-completion callback seeds the adopted head from its existing config and catalogue. It retains no catalogue, graph, lease, previous-key, or closure-membership copy. Share declarer-table construction with the original preparation path.

Run the callback after Ready or Unavailable has published and its terminal completion has returned. Let Changes execution return whether terminal completion committed. Seed from the owning Changes loop after the execution task returns, outside its classification span and write-activity lease. Hold no cancellation commit, publication, warning, or runtime pointer lock while seeding. Check current state and cancellation before admission. Await and drain the blocking callback through the existing background lifecycle. A running seed can delay replacement background work by the remainder of its fact pass. Seed only its original generation. Transparent generation wrappers forward the callback.

An edit reads completed predecessor facts without waiting for the lazy cell. If seed work has not completed, calculate the current keys fully and seed the current facts. The next edit can reuse them. Seeding never changes an existing key or the runtime's weak pointer. Keep the current canonical encoder and differential corpus unchanged.

Evidence: `.context/incremental-render-keys/startup-profile-report.md` and `.context/incremental-render-keys/startup-options-check.md`.

## Milestone 1: Contract and documentation check

Depends on: none

- [x] Check the key-input contract and confirm that this change needs no protocol update.
- [x] Run the fresh read-only options check. Merge its result into the design.
- [x] Validate, commit, and push this plan before implementation. Continue under the user's authorization.

Evidence: `.context/incremental-render-keys/options-check.md`.

## Milestone 2: Differential tests and key reuse

Depends on: 1

- [x] Delegate the non-UI implementation in this workspace.
- [x] Write red tests first. Assert exporter jobs are avoided after an isolated edit and unchanged generation.
- [x] Compare incremental and full keys over generated edit sequences. Cover content, import addition and removal, moves, shared inputs, renamed exports, bindings, resolution, CSS Modules, stories, fallback transitions, and cycles.
- [x] Cover common-root switches, startup rechecks, missing modules that appear or disappear, declarer moves, longest handle-prefix changes, runtime manifests leaving chains, and unattributed bindings.
- [x] Implement compact facts, invalidation, generation lifetime, and Serve wiring.
- [x] Preserve full startup and base calculations. Test retention release and side isolation.
- [x] Update crate README entry points if needed. Keep the protocol unchanged.
- [x] Run targeted tests and record each added test's runtime and red assertion.

Evidence: `.context/incremental-render-keys/implementation.md`.

## Milestone 3: Equivalence and local measurement

Depends on: 2

- [x] Run the repository suite and complete gate from `AGENTS.md`. Check disk and memory before each large Cargo build.
- [ ] Build and smoke-test Serve with `examples/basic` and the large React fixture.
- [ ] Measure `render.inputs` and edit to Changes ready on both catalogues against `origin/main`.
- [ ] Measure three title edits in the current Mokly Cloud catalogue's `slug-editor.tsx` against `origin/main`. Also measure a renderer-closure edit.
- [x] Prove byte-identical published files on `examples/basic`, large HTML, large React, and `mokly-cloud`.
- [x] Compare incremental and full render keys over the real JavaScript fixtures and generated edits.
- [x] Audit preservation against the frozen base, commit with Conventional Commits, and push the candidate.
- [x] Measure retained fact bytes on `mokly-cloud`. Send the candidate SHA to the parent for its six-round A/B and ten-edit memory sessions.

Evidence: `.context/incremental-render-keys/verification.md`.

The original complete gate passed on `e44ee137a`. Decision 2 adds targeted verification and repeated proofs. The merged-tree complete gate remains in Milestone 5.

## Milestone 4: Defer startup reuse preparation

Depends on: 2

- [x] Complete the fresh read-only options check and merge its lifecycle advice into the design.
- [x] Write red tests for full unseeded startup, explicit seed reuse, publication order, and an edit racing the seed.
- [x] Delegate full startup keys without eager facts and generation-owned post-completion seeding.
- [x] Keep `session.rs`, `types.rs`, and `lib.rs` changes small. Keep the protocol and all key formats unchanged.
- [x] Run targeted graph, runtime, wrapper, completion, and real-sidecar checks. Repeat new asynchronous tests ten times.
- [x] Repeat the real-fixture differential key proof and strict published-byte proof on all four fixtures.
- [ ] Measure retained and post-Changes seed memory, startup spans, and three isolated edits. Commit, push, and send the new SHA to the parent.

Evidence: `.context/incremental-render-keys/startup-investigation.md` and the revised verification record.

## Milestone 5: Gate, review, and pull request

Depends on: 3, 4

Review can run while the parent measures the frozen candidate. Integration waits for the parent's acceptance.

- [ ] Run `implementation-review` against the frozen base after the push. Check each new finding. Apply its fix rounds and re-review.
- [ ] Record the parent's speed, output, and memory results. Fix branch-caused failures.
- [ ] After the parent accepts the Cloud result, merge `origin/main` once with the `git-merge` skill. Rerun the complete gate on the merged tree.
- [ ] Repeat the byte proof if integration changes graph render-key or closure code. Audit, commit, and push the final tree.
- [ ] Record any remaining findings with the required follow-up items.
- [ ] Delete this plan under the `plans` skill. Preserve its dated calls and permalink in the pull request description.
- [ ] Open the pull request into `main`. Watch final CI with `scripts/ci-wait.sh`. Fix branch-caused failures. Report PR and SHA. Do not merge.
