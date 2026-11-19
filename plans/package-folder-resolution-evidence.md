# Package folder resolution evidence

Status: Active. On branch `calummoore/mokly-folder-export-evidence-7rox`, no pull request yet. The pull request that completes the work deletes this plan.

Mokly can reuse a compiled bundle after a new file changes esbuild's package
folder selection. The shared evidence walker misses folder mappings with a
request tail. This affects compiled reuse and can affect saved resolution plans.
The fix observes every selectable candidate through the existing evidence owner.

The user authorized this plan and its implementation on 2026-11-19. The
performance orchestrator chose the shared evidence approach on that date.
Speed, equal native results, bounded memory, and safe stored entries take priority.
The user holds every merge into `main`. This branch opens a pull request only.
The starting `origin/main` commit is `6ae96ed08`.

Contract owners:

- [Compiled recipes](../docs/protocol/mokly-sidecar-recipes.md).
- [Serve edit plans](../docs/protocol/mokly-sidecar-plans.md).
- [Bundle cache](../docs/protocol/mokly-base-cache.md).
- [Render sidecar README](../packages/mokly/src/sidecar/README.md).

## Design calls of 2026-11-19

These calls belong to the performance orchestrator. The user delegated changes
that keep output equal and memory bounded on 2026-11-16 and 2026-11-19.

### 1. Observe every selectable package folder candidate

- **Severity:** High. **Likelihood:** Common. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/resolution-evidence.ts`.
- **Terms:**
  - **Evidence:** Recorded inputs that must stay equal before Mokly reuses a bundle or resolution plan.
  - **Folder mapping:** An `exports` or `imports` key ending in `/` that esbuild matches as a prefix.
- **Background:** The sidecar uses esbuild 0.28.2 to compile catalogue modules. Reuse compares recorded inputs with current inputs.
- **Problem:** The evidence walker skips folder keys with a request tail. A preferred file can appear without invalidating reuse.
- **Impact if no action:** Mokly can return stale JavaScript and write stale HTML during a successful strict build.
- **Root question:** How can every reused result keep the current native package selection?
- **Options:**
  - **A.** Extend the shared package-map walker. Observe each matched target plus its tail through the existing candidate owner. Effort: Medium.
  - **B.** Record candidate paths from esbuild's resolver itself. This requires a new integration with upstream resolution internals. Effort: Large.
  - **C.** A, plus a repeated-key scan that makes evidence incomplete for any repeated manifest key. Harmless repeated fields can then prevent reuse. Effort: Medium.
  - **D.** A, plus a manifest reader that preserves relevant repeated values. Observe every relevant value without changing configuration parsing. Effort: Large.
- **Left out:** Route-specific guards leave other routes stale. Disabling reuse changes other reuse decisions. Re-resolving on every hit adds work forbidden by the current contract. Changing nothing fails the goal.
- **Wider fix:** D extends A. One package-map owner covers installed, linked, self-package, and aliased-self routes.
- **Previous examples:** The workspace 54 self-package recipe returns `original-index` after `sub/value.ts` appears.
- **Recommendation:** D, changed from A after the options check. C can end reuse for harmless repeated keys, which conflicts with the task.
- **Action:** fix now, apply D.

Shared assumptions: Native esbuild selection remains authoritative, as the task
requires. The existing candidate owner and bounds remain, as the orchestrator
requires. The source audit must confirm every inexact route. Arrays and condition
objects must observe every possible string target at its actual package root.
Duplicate keys and percent decoding are leads to test before choosing mechanics.
The options check confirmed both gaps from native source. Its report is
`.context/package-folder-resolution-evidence/options-check.md`.

Orchestrator calls of 2026-11-19: preserve relevant repeated manifest values,
because rejecting harmless repeated fields changes unrelated reuse. Decode the
package-relative target and tail, because esbuild decodes that path before
selection. Follow nested main-field candidates for inexact folder mappings
through the shared candidate owner. Keep other candidate routes unchanged.
Keep `#` requests incomplete, because they already prevent reuse and storage.
The `imports` audit proves that existing safe behavior instead of adding a walker.

### 2. Preserve reuse contracts and resource bounds

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/physical-inputs.ts`.
- **Background:** The same evidence protects memory reuse, saved plans, and stored bundles. Existing bounds prevent unbounded records and reads.
- **Problem:** A broad workaround could change unrelated reuse, slow edits, or increase memory.
- **Impact if no action:** A correct selection fix could violate the user's speed and memory requirements.
- **Root question:** How can this fix preserve the existing reuse and resource contracts?
- **Options:**
  - **A.** Keep the evidence shape, bounds, disk format, and reuse checks. Let the existing toolchain hash reject old sidecar captures. Effort: Medium.
  - **B.** Introduce a versioned evidence format with a migration boundary. This adds storage and validation work without a known need. Effort: Large.
- **Left out:** A new setting, gate, retry, or process breaks the task constraints. Larger bounds break the memory requirement. A broad refusal of complete evidence changes unrelated reuse.
- **Wider fix:** A. The existing bounded owner and toolchain identity already provide the needed safety boundary.
- **Previous examples:** `toolchain.ts` hashes every sidecar dist file. Old compiled recipes already fail that identity check after a toolchain change.
- **Recommendation:** A. Add the missing observations without changing their consumers or their formats.
- **Action:** fix now, apply A.

Shared assumptions: Keep startup and edit times within measurement noise on
`mokly-cloud`. Keep memory within 2% of current `main`. Both requirements come
from the task. Measurements use equal authored inputs, one physical catalogue
root, balanced before/after runs, and the existing measurement procedure.

## Milestone 1: Documentation and contract audit

Depends on: none

Confirm that the existing rules already require current package selection.
Keep protocol rules unchanged. Add useful entry-point context only if needed.

- [ ] Read the contract owners and confirm the fix preserves their requirements.
- [ ] Audit the README for any entry-point change. Update it only when needed.

## Milestone 2: Native route audit and shared fix

Depends on: 1

Audit esbuild 0.28.2 and reproduce each confirmed gap before implementation.
Keep the source audit and failing runs under `.context/package-folder-resolution-evidence/`.

- [ ] List every inexact `exports` and `imports` route with esbuild source lines.
- [ ] Confirm installed, linked, self-package, and aliased-self selection roots.
- [ ] Confirm dependency-import plan replay, duplicate keys, and percent-decoded targets with native evidence.
- [ ] Reproduce the marked `serveEdit` lead and report its scope to the performance orchestrator before changing that route.
- [ ] Add failing regression cases at the lowest public boundary for the confirmed gaps.
- [ ] Fix the shared walkers through the existing candidate owner. Preserve unrelated reuse decisions.
- [ ] Cover arrays, condition objects, non-identity mappings, and nested main-field candidates of mapped folders.
- [ ] Confirm that an internal `imports` folder mapping still prevents reuse and storage through the existing incomplete-evidence rule.
- [ ] Prove in-process reuse, disk restoration after restart, and strict build select the preferred file.
- [ ] Prove an unrelated file leaves reuse available. Inspect the named real-world package manifests.
- [ ] Run targeted tests. Repeat new asynchronous tests ten times. Record their cost and failing assertions.

## Milestone 3: Measurement and smoke verification

Depends on: 2

Measure the fix against current `main` on the real `mokly-cloud` catalogue.
Save raw results and the before/after table under the context directory.

- [ ] Compare startup, normal edits, peak memory, and operation counts with balanced runs.
- [ ] Confirm memory stays within 2% and timing stays within noise. Investigate each failure before acceptance.
- [ ] Confirm native output and unaffected catalogue output. Record identity changes separately when the toolchain requires them.
- [ ] Run the strict example build and smoke the served catalogue after the final build.

## Milestone 4: Verification, review, and pull request

Depends on: 1, 2, 3

The orchestrator owns these steps. Keep Git 2.45 or later first on `PATH`,
install git-lfs, and use pinned Bun. Use locked Cargo dependencies. Check free
disk and memory before large builds. Disable Cargo incremental and dev debug
information. Give each checkout its own target directory. Run one Cargo build
at a time. Keep workspace 54's changes when current `main` needs integration.

- [ ] Run targeted tests, `cargo xtask check --suite repository`, and `cargo xtask check`.
- [ ] Commit with Conventional Commits and push. Send the implementation SHA to the performance orchestrator.
- [ ] Review the full diff against `origin/main` with `implementation-review` after the push. Check new findings. Apply up to two fix rounds. Record follow-up items for remaining findings. Re-review once.
- [ ] Delete this plan after every other required TODO passes and review rounds finish.
- [ ] Open the pull request against `main`. Preserve this plan's dated calls and permalink in its description. Watch CI with the finish-work script. Fix branch failures. Report results to the sending session. Do not merge.
