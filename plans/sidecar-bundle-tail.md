# Shorter sidecar bundle response work

Status: Active. On branch `calummoore/mokly-sidecar-bundle-tail-mge9`, no pull request yet. The completing pull request deletes this plan.

The sidecar bundles catalogue JavaScript for the Rust core. Each Serve edit waits for its post-compile graph, recipe, size check, and response. This change removes repeated work from that path. Every response frame and every published byte must stay equal to `main`.

The user authorized design, implementation, local proofs, review, and a pull request on 2026-11-21. The parent performance session owns official measurements and every merge into `main`. This branch must not merge its pull request.

Contract owners:

- [Sidecar transport](../docs/protocol/mokly-sidecar.md).
- [Compiled recipes and release](../docs/protocol/mokly-sidecar-recipes.md).
- [Component properties](../docs/protocol/mokly-component-props.md).
- [Sidecar code guide](../packages/mokly/src/sidecar/README.md).

## Measurement and design

The temporary probe and its recordings stay under `.context/sidecar-bundle-tail/`. The cloud fixture is `mokly-ai/mokly-cloud` at `194fdb78`, with its own npm install under `ts/`. It uses this workspace's release core and built npm packages. The edit changes the `title:` string at line 35 of `docs/mockups/src/screens/product/settings/slug-editor.tsx`. Serve uses `mokly.config.json` and `--base HEAD`.

The initial split uses `beb87a53a`. On 2026-11-21, the user required `main` at `793d0c77d` after PR #459. This branch fast-forwarded to that commit before product code. All end-to-end comparisons use the updated base.

Evidence: `.context/sidecar-bundle-tail/profile-split.json` and the candidate JSON reports in that directory.

### 1. Remove repeated post-compile work

- **Severity:** Low. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/json.ts`, `recipe-size.ts`, `transport.ts`, `bundle-graph.ts`, and the send path.
- **Terms:**
  - **Recipe:** The compiled code, source records, metadata, and module graph that the sidecar returns to the core.
  - **Frame:** One newline-delimited JSON message between the core and the sidecar.
- **Background:** Serve waits for the sidecar response before it publishes Changes. Three pinned-cloud edits spent a mean of 303 ms after compilation. Graph construction, response encoding, and size checks repeat work on this path.
- **Problem:** Repeated path conversion and serialization keep useful CPU time on every edit's critical path.
- **Impact if no action:** Warm edits keep this avoidable work.
- **Root question:** How can each warm edit reach published Changes at least 50 ms sooner with identical bytes?
- **Options:**
  - **A.** Optimize the encoder and memoize graph names within one graph call. This has fewer moving parts. Its isolated saving is about 47 ms, below the target. Effort: Medium.
  - **B.** A, plus encode the shared recipe members once for size checks and sending. This adds a short-lived encoding owner. It keeps both frame limits and their rejection text. Effort: Medium.
  - **C.** B, plus memoize root normalization. The measured graph saving is about 1 ms. It adds another cache with little measured benefit. Effort: Medium.
  - **D.** The same three cuts as B, with shared encoding only for a newly compiled recipe. Publish its texts after the final identity step. If that step changes identity, use normal encoding. Reuse keeps its current count. One encoder owns the replacements. Effort: Medium.
- **Left out:** Unsorted `JSON.stringify` changes frame bytes and negative zero. Compression and smaller answers change frame bytes. Moving encoding to a worker still delays its response and adds memory. Proof and callback changes are outside the user's scope.
- **Wider fix:** D. It publishes shared text only after the last change and keeps one encoding rule.
- **Previous examples:** [Bundle response single encoding](./follow-ups/bundle-response-single-encoding.md) recommends shared member text. [Boot and encoding](./follow-ups/sidecar-boot-and-encoding.md) requires negative zero. [Closed import-proof work](./follow-ups/serve-postcompile-import-proof-cost.md) excludes another proof experiment.
- **Recommendation:** D, changed from B after the fresh options check. It applies the same approved cuts and avoids identity refresh logic.
- **Action:** Design call by the workspace orchestrator on 2026-11-21. Apply D as the ownership of the user-approved cuts. It changes no requirement or reuse rule. No further user decision is needed.

User approval on 2026-11-21: the performance orchestrator chose cuts 1, 2, and 3 together and dropped cut 4. The user confirmed eager `Object.entries` reads and existing array semantics. A red test must prove the graph cache ends with one call. Before the SHA, report interleaved warm edit pairs and one cold start beside the isolated savings.

Shared assumptions come from the task: keep frame bytes, publication bytes, accepted limits, rejection text, compile callbacks, and reuse rules. The task permits no slower cold or basic run. Cold 10-edit whole-tree memory must stay within 2% of `main`. Official interleaved measurements decide acceptance.

Measured ranking uses isolated warm rounds on the same recorded cloud result. These observations do not establish end-to-end acceptance:

1. A call-local cache before physical path and logical name conversion saves about 31 ms in graph construction.
2. A faster object encoder saves about 16 ms. It keeps `Object.entries` to retain eager getter reads. It keeps array iteration semantics.
3. One shared encoding removes another serialization pass. It saves about 9 ms after the faster encoder.
4. A root-normalization memo saves about 1 ms in graph construction. Leave `path-scope.ts` unchanged.

### Encoding ownership

- Keep sorted UTF-16 keys, negative zero, omitted undefined object members, undefined array items as `null`, and current non-finite number text.
- Keep the current getter evaluation order and the current array iterator behavior.
- Build shared compiled and module texts once during a new recipe's size check. Reuse calls keep their existing count. A small encoding hook may enter the recipe assembly path. It must leave the protected reuse path unchanged.
- Count both the maximum-id bundle response and the restore request. Keep plan removal, then evidence removal, then the exact rejection.
- Keep encoded text outside the wire object. Its lifetime ends after the response sends. It must not stay with a retained generation.
- The final recipe step can remove metadata identity and change compilation and generation identities after size checking. Publish shared texts after that step only when it changed none of those fields. Otherwise use normal encoding. Never send stale identity text.
- Send consumes a result-keyed weak-map entry and supplies object replacements to `jsonText`. A replaced member falls back to normal encoding. Ordinary responses and reuse paths keep the normal encoder. `session.ts` stays unchanged.

### Graph cache ownership

- Keep path conversion results only inside one synchronous `moduleGraph` call.
- Preserve every graph edge, key order, module sort, and physical-map update.
- Keep no filesystem observations or names between compiles.

Protected areas: `PlannedRelative.verify` and its proof helpers, compile callbacks, PR #449 reuse checks, `session.ts`, the reuse branch of `bundleResult`, the core pool, and sidecar protocol documents.

## Milestone 1: Confirm existing contracts

Depends on: none

- [x] Read the area README and transport, recipe, and property requirements.
- [x] Measure the post-compile split with a temporary probe outside tracked files.
- [x] Obtain a fresh Claude Opus 5.5 max options check. Save its report under `.context/sidecar-bundle-tail/`.

Evidence: `.context/sidecar-bundle-tail/options-check.md`. The check added D. The orchestrator selected D because it keeps the approved cuts without a stale-field refresh list. The check's base-label concern was already fixed before its report arrived.

- [x] Send the split, ranked options, and any user or protocol decisions to the parent session.
- [x] Confirm that byte preservation requires no protocol change.

## Milestone 2: Encoding and graph changes

Depends on: 1

- [ ] Add differential encoder cases against the original encoder. Cover generated values, negative zero, holes, undefined, UTF-16 keys, getters, and long strings.
- [ ] Capture bundle results for the fixture proof. Record that the HTML fixture starts no sidecar.
- [ ] Add a fixed-result frame and exact-limit rejection test. Cover evidence pruning and the final frame after late identity changes. Keep the whole-compiled-text count used by existing limit tests. Show each new requirement test fail on an assertion first.
- [ ] Add a cache-lifetime case with changed inputs between two compiles. Use one metafile with two roots. Assert physical paths. Show that a persistent-cache mutant fails.
- [ ] Implement the faster encoder and one shared recipe encoding.
- [ ] Implement the call-local graph conversion cache.
- [ ] Run targeted tests, type checks, and lint. Record test costs and required repeated asynchronous runs.

## Milestone 3: Acceptance evidence and publication

Depends on: 2

- [ ] Run the repository suite and complete gate from `AGENTS.md`. Check disk and memory before each large Cargo build. Keep one heavy job at a time.
- [ ] Compare local warm edits and one cold start against `main` on the pinned cloud fixture. Check basic.
- [ ] Ask the parent for workspace 206's byte-proof helper.
- [ ] Prove strict publication byte equality on cloud, basic, full large HTML, and full large React fixtures.
- [ ] Record response frames of one edit session in both arms and compare their bytes.
- [ ] Merge `origin/main` when it moves, with the `git-merge` skill. Preserve workspace 220's reuse changes.
- [ ] Commit with Conventional Commits and push the branch. Send its SHA to the parent for official timing and memory checks.
- [ ] Review the complete local diff against `origin/main` with the `implementation-review` skill. Fix confirmed findings, record other items, and re-review as that skill requires.
- [ ] Delete this plan after all other required work and review rounds finish.
- [ ] Open the pull request into `main`. Copy the dated calls and the plan permalink into its description. Watch CI with `scripts/ci-wait.sh`. Record unrelated Site Lighthouse failures without rerunning them. Send the PR and SHA to the parent. Do not merge.
