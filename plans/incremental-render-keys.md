# Reuse render keys after Serve edits

Status: Active. On branch `calummoore/mokly-incremental-render-keys-38ts`, no pull request yet. The completing pull request deletes this plan.

Serve computes every exporter key after each edit. Reuse the previous key when every input of that key remains equal. Keep the existing key format, published bytes, protocol, and render store identity. The user authorized this scope and autonomous design calls on 2026-11-20. The parent performance orchestrator owns cloud measurements and every merge.

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

The fresh options check on 2026-11-20 kept recommendation A. Keep each fact at 256 bits. Identify each common closure by its selected root and exact records. Build the new key map from current eligible exporters only. Never patch a copy of the previous map. Keep all fact, comparison, and walk work inside `render.inputs`. Measure an edit inside the renderer closure as well as an isolated exporter edit.

Create the shared weak-pointer cell only in the Serve-head runtime builder. All per-attempt runtime copies share that cell. Build facts only when this cell exists. Pass previous keys only in `ServeEdit` capture mode, including during startup rechecks. Use fixed-seed generated edits and fixed cases without a new property-test dependency. Accept a full calculation after a failed candidate loses its weak predecessor.

Compare the shared digest separately. A changed shared digest invalidates every exporter. Compare the renderer and preview closure identities once, and track each exporter's render mode. Recompute affected common-mode exporters. Missing renderer and preview cases retain the current fallback rules. Never reuse a fallback from the previous generation. Serialization failure retains the whole-bundle fallback and supplies no reusable facts.

Keep facts with `RenderKeys`. Keep one weak pointer to the latest keys in each render runtime. Head and base runtimes have separate pointers. Enable reuse only for Serve head edits. Startup seeds facts through a full calculation. Base and non-Serve calls stay full calculations. Facts own no prior generation, module graph, catalogue, sidecar lease, or reverse index. Releasing a generation releases its facts. A missing weak predecessor means a full calculation. Keep changes outside graph key modules small, especially `session.rs`, `types.rs`, and `lib.rs`.

## Milestone 1: Contract and documentation check

Depends on: none

- [x] Check the key-input contract and confirm that this change needs no protocol update.
- [x] Run the fresh read-only options check. Merge its result into the design.
- [ ] Validate, commit, and push this plan before implementation. Continue under the user's authorization.

Evidence: `.context/incremental-render-keys/options-check.md`.

## Milestone 2: Differential tests and key reuse

Depends on: 1

- [ ] Delegate the non-UI implementation in this workspace.
- [ ] Write red tests first. Assert exporter jobs are avoided after an isolated edit and unchanged generation.
- [ ] Compare incremental and full keys over generated edit sequences. Cover content, import addition and removal, moves, shared inputs, renamed exports, bindings, resolution, CSS Modules, stories, fallback transitions, and cycles.
- [ ] Cover common-root switches, startup rechecks, missing modules that appear or disappear, declarer moves, longest handle-prefix changes, runtime manifests leaving chains, and unattributed bindings.
- [ ] Implement compact facts, invalidation, generation lifetime, and Serve wiring.
- [ ] Preserve full startup and base calculations. Test retention release and side isolation.
- [ ] Update crate README entry points if needed. Keep the protocol unchanged.
- [ ] Run targeted tests and record each added test's runtime and red assertion.

Evidence: `.context/incremental-render-keys/implementation.md`.

## Milestone 3: Equivalence and local measurement

Depends on: 2

- [ ] Run the repository suite and complete gate from `AGENTS.md`. Check disk and memory before each large Cargo build.
- [ ] Build and smoke-test Serve with `examples/basic` and the large React fixture.
- [ ] Measure `render.inputs` and edit to Changes ready on both catalogues against `origin/main`.
- [ ] Measure three title edits in the current Mokly Cloud catalogue's `slug-editor.tsx` against `origin/main`. Also measure a renderer-closure edit.
- [ ] Prove byte-identical published files on `examples/basic`, large HTML, large React, and `mokly-cloud`.
- [ ] Compare incremental and full render keys over the real JavaScript fixtures and generated edits.
- [ ] Measure retained fact bytes on `mokly-cloud`. Send the candidate SHA to the parent for its six-round A/B and ten-edit memory sessions.
- [ ] Record the parent's speed, output, and memory results when available. Fix branch-caused failures.

Evidence: `.context/incremental-render-keys/verification.md`.

## Milestone 4: Gate, review, and pull request

Depends on: 3

- [ ] Audit preservation, commit with Conventional Commits, and push.
- [ ] Run `implementation-review` against `origin/main` after the push. Check each new finding. Apply its fix rounds and re-review.
- [ ] Record any remaining findings with the required follow-up items.
- [ ] Delete this plan under the `plans` skill. Preserve its dated calls and permalink in the pull request description.
- [ ] Open the pull request into `main`. Watch final CI with `scripts/ci-wait.sh`. Fix branch-caused failures. Report PR and SHA. Do not merge.
