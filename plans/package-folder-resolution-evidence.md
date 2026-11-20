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
Keep full `#` requests incomplete, because they already prevent reuse and storage.
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

### 3. Observe folder mappings during marked reuse

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/serve-edit-paths.ts`.
- **Terms:**
  - **Marked compile:** A Serve edit compile that records no full evidence and can reuse its live inputs alone.
  - **Live inputs:** Consumed file digests, resolution metadata, and folder membership that marked reuse checks.
- **Background:** The captured evidence fix cannot reach a marked compile. The marked route follows a separate live-check rule.
- **Problem:** A native reproduction kept `original-index` after `sub/value.ts` appeared. A fresh marked compile selected `preferred-file`.
- **Impact if no action:** A live Serve session can show stale output until a restart or another changed live input.
- **Root question:** How can marked in-process reuse keep native folder-map selection without slowing edits or increasing memory?
- **Options:**
  - **A.** Keep this change on captured evidence and defer the marked gap. This needs an exception to the whole-class goal. Effort: Small.
  - **B.** Share one folder-candidate description between full capture and marked live checks. Add live observations only for folder-map selections. Effort: Medium.
  - **C.** Withhold the marker for affected selections. Unchanged affected compiles lose reuse and take longer. Effort: Medium.
- **Left out:** Full capture on each edit reverses the speed decision. Re-resolving every hit breaks the reuse contract. A second PR splits the requested single fix.
- **Wider fix:** B. Both owners use one description, so their folder candidates cannot drift.
- **Previous examples:** [Marked package entry targets](./follow-ups/marked-package-entry-targets.md) records related earlier-entry and index-fallback gaps.
- **Recommendation:** B. It keeps correct output and keeps reuse for unchanged folder-map selections.
- **Action:** fix now, apply B.

The performance orchestrator chose B on 2026-11-19. A stale result until a
restart is wrong output, so the whole class includes marked reuse. This call
authorizes the marked protocol change only for package folder-map selections.
Full capture and marked checks must use one shared candidate description.
Full `#` capture stays incomplete. Marked `imports` folder selections join the
same source audit and the same description when esbuild resolves them inexactly.

Shared assumptions: native output, existing bounds, unchanged disk format,
unchanged settings and process rules, timing within noise, and memory within 2%
remain task requirements. The earlier-entry and index-fallback forms of the
linked follow-up stay deferred unless this description covers them without
extra work. Any such coverage needs a red-first test and a follow-up update.

### 4. Observe native PnP package locations

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/resolution-evidence.ts`.
- **Terms:**
  - **PnP:** Yarn's package registry metadata that lets esbuild select physical packages outside ordinary lookup roots.
- **Background:** A native PnP reproduction kept complete evidence and stale reuse after a preferred file appeared. The current lookup-root list omitted its physical package.
- **Problem:** A shared folder walker still misses a package root that its caller never supplies.
- **Impact if no action:** The PnP route keeps the same stale-bundle defect after the ordinary routes are fixed.
- **Root question:** How can PnP folder-map reuse keep native selection with sound capture evidence?
- **Options:**
  - **A.** Index declared registry locations and alias identifiers as a bounded superset. Describe folder candidates before native resolution. Effort: Medium.
  - **B.** Implement the PnP package-selection algorithm in the evidence owner. This duplicates locator, fallback, and ignore rules. Effort: Large.
  - **C.** A with a pre-build pinned manifest, one shared inspection budget, and a final uncovered-folder check. Apply the approved limit fallback. Effort: Medium.
  - **D.** C for every bare PnP request, including plain deep imports and main fields outside folder mappings. This widens the approved class. Effort: Medium.
  - **E.** Record after native selection with a change-time fence. This changes the current completeness rule and adds another timing path. Effort: Large.
- **Left out:** A native probe shares resolver caches and can pair an old selection with new observations. Final-metafile discovery records full evidence after selection. A forced extra attempt changes the compile contract. Blanket refusal changes supported reuse. A resolve on each hit breaks the reuse contract.
- **Wider fix:** C within this change. D covers additional PnP lookup classes that the task defers.
- **Previous examples:** The native physical-root PnP reproduction of this task uses `.pnp.data.json` and a non-identity folder mapping.
- **Recommendation:** C, changed from A. It states the timing and shared budget. The options check recommended D, which widens the folder-only scope.
- **Action:** fix now, apply C.

This is the orchestrator's call of 2026-11-19. An earlier proposed native
probe was withdrawn before implementation after its shared resolver-cache
window was identified. The catalogue uses the existing metadata bounds and
supports esbuild's recognized data and embedded-state forms. It applies only
when folder candidates need those roots. Ordinary non-folder PnP reuse stays
unchanged except for the explicit item 5 limit fallback. No new attempt,
process, format, or hit-time resolve is allowed.
These assumptions come from the task and the current capture contract.

The options check's synchronized cache-window lead did not reproduce stale
output for source-owned or dependency-owned roots on esbuild 0.28.2. Both
native compiles selected and reused the preferred file. The wider non-folder
scope and the change-time fence are not needed for that lead. Evidence is
`pnp-cache-window-source-owned.log` and `pnp-cache-window-proof.log` under the
context directory. PnP inspection, commitment, and final checks share one
metadata budget. A fresh commitment compares the pinned digest with a current
read. Archive or virtual paths keep the loader's existing disposition.

### 5. Fail closed at metadata discovery limits

- **Severity:** High. **Likelihood:** Rare. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/physical-input-reader.ts` and the package-folder discovery callers.
- **Background:** Discovery can reach the existing metadata limit before it can distinguish a folder mapping from an ordinary import.
- **Problem:** Keeping an unproved capture or marker can return stale output. Refusing reuse can also affect an oversized ordinary import.
- **Impact if no action:** An unproved full capture can persist stale output in disk bundles and saved plans.
- **Root question:** Which fallback applies when metadata limits prevent folder classification?
- **Options:**
  - **A.** Keep the existing limits. Make full evidence incomplete and withhold the marked marker when discovery cannot classify the import. Effort: Small.
  - **B.** Stream beyond the current byte limits to finish classification. Retained memory stays bounded, but edit I/O can grow without those bounds. Effort: Medium.
  - **C.** A with a late selected-root classification that can retain ordinary PnP reuse when only the registry is oversized. It adds another path and does not help an oversized selected manifest. Effort: Medium.
- **Left out:** Keeping unproved reuse can return stale output. Raising retained-memory bounds breaks the task. A native probe shares resolver caches. No third bounded-prefix outcome can distinguish identical prefixes with different later map fields.
- **Wider fix:** A. The shared bounded discovery fails closed for both owners.
- **Previous examples:** Full capture already rejects incomplete evidence. The marked paths pass already refuses a marker when its staged paths exceed its bound.
- **Recommendation:** A. Correct output and unchanged memory bounds take priority over reuse at a metadata limit.
- **Action:** fix now, apply A.

The performance orchestrator chose A for marked reuse on 2026-11-19, then
confirmed A for both owners on that date. This is the explicit limit exception
to unchanged reuse. Before this fix, those oversized captures were not proven
correct either. A native ordinary PnP manifest of 1,048,749 bytes reused before
the fix and loses full and marked reuse after it. At 1,047,625 bytes, both modes
keep reuse. Output stays equal in both cases. The unchanged limits are 1 MiB
per metadata file and 8 MiB total. Record each affected route in the protocol
and PR. Report the largest file and total marked-discovery metadata bytes for
`mokly-cloud`, `examples/basic`, and the large fixtures.

Shared assumptions: these existing limits and correct output stay mandatory.
This exception adds no limit, setting, format, process, or retry. Non-folder
reuse below the limits stays unchanged. The real catalogues must keep marked
edit reuse and meet the timing and memory conditions.

### 6. Keep folder file observations private

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/bundle-recipe.ts` and the compiled-reuse predicates in TS and Rust.
- **Background:** Resolution metadata also feeds public render keys. A staged digest for an inactive manifest or PnP state can change every view's shared key.
- **Problem:** Adding the new digests to both full and marked render inputs keeps mode equality, but changes main's public keys and Changes.
- **Impact if no action:** Equal source and rendered content can gain different published identities.
- **Root question:** How can reuse validate the new folder files without adding them to public render inputs?
- **Options:**
  - **A.** Keep the digests in existing compiled physical inputs and add Rust retained validation for them. Mapping source inputs and duplicate hashing can cost time. Effort: Medium.
  - **B.** Put bounded folder file observations in the existing private reuse-evidence table of marked results. Check them through the existing physical matcher in each runtime. Effort: Medium.
  - **C.** B with repository-local watch-only paths from the private table. It changes the rule that reuse evidence is not a watch input. Effort: Medium.
- **Left out:** Shared public-metadata staging changes render keys. A new wire field changes the format. Encoded cache paths in render metadata mix two meanings and need another decoder.
- **Wider fix:** B. Private cache observations stay separate from render inputs and share the established physical comparison.
- **Previous examples:** Full reuse evidence already records cache-only files without moving render keys. Retained marked reuse currently uses only the logical live stamps.
- **Recommendation:** B. It preserves public output and avoids logical-parent encoding and duplicate source hashing.
- **Action:** fix now, apply B.

The performance orchestrator chose B on 2026-11-19. A render-key change alters
published identities and Changes, so public render inputs must stay equal.
The draft that staged extra digests in both modes' `metadataInputs` is discarded.
A marked result may carry bounded folder-map file observations in
`reuseEvidence.inputs`. It keeps `complete: false`, `durable: false`, and
`uncaptured: "serveEdit"`. It stays off disk. Other marked results keep an empty
table. An oversized or dropped folder table removes the marker.

Shared assumptions: the fields, physical input kinds, disk format and version,
byte bounds, settings, and processes stay unchanged. Both runtime predicates
reuse their established physical matcher and the generated input type. Existing
live directory checks remain. A main/main control defines any per-run identity
exceptions. No public key or index field is silently excluded.
The fresh options check kept B. C changes watch behavior outside the approved
scope. Its report is `private-folder-options-check.md` under the context
directory. Full admission stays distinct from marked admission in both
runtimes. They share per-entry comparison, not the full-only completeness gate.

### 7. Remove cold PnP helper loading

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/pnp-inputs.ts` and its existing preparation callers.
- **Background:** The Session import graph loads the new PnP parser even for a catalogue with no PnP state. Each new sidecar worker pays that cold import.
- **Problem:** A paired fresh-worker diagnostic measures about 58 ms of added Session import work. Cloud startup restores show a similar 50 to 90 ms increase.
- **Impact if no action:** Every fresh Serve worker pays unused parsing-helper initialization.
- **Root question:** How can a catalogue load package parsing code only when its resolution needs it?
- **Options:**
  - **A.** Load the parser through the existing asynchronous preparation boundary only after PnP discovery needs it. Keep the synchronous candidate walk after preparation. Effort: Small.
  - **B.** Make the package-map walk asynchronous throughout. This can defer every helper, but changes more call sites and checks. Effort: Medium.
  - **C.** Keep eager loading and accept its measured cost. This fails the performance orchestrator's speed-first call. Effort: Small.
  - **D.** Load the CommonJS Babel traversal helper synchronously on the first JavaScript-form PnP parse. Keep the parser signature, read order, and callers. Effort: Small.
  - **E.** Replace Babel traversal with a small parser-AST walker. This must reproduce binding and scope rules, with more parity checks. Effort: Medium.
- **Left out:** A separate parser process adds a process. Dropping supported PnP forms changes output or reuse. Replacing the native resolver changes the class and its risk. A Rust parser adds a boundary and dependency that D avoids. Background prewarming and the Node compile cache still load unused code in every worker.
- **Wider fix:** D. The parser owns its optional dependency, so every synchronous and asynchronous caller gets the same lazy behavior.
- **Previous examples:** The recorded 24-worker diagnostic compares Session import, compiled import, first toolchain inventory, and cached identity. Compiled import and toolchain inventory show no clear added cost.
- **Recommendation:** D, changed from A by the fresh options check. It removes the measured dependency without changing callers or read order.
- **Action:** fix now, apply D.

The performance orchestrator chose removal on 2026-11-19 under the user's
speed-first delegation. Keep output byte-identical and keep every rule and
test. If a synchronous call site cannot gain lazy loading in a Small change,
report that call site and cost to the performance orchestrator before widening
this change. Repeat the same 24-worker, six-pair diagnostic. Cold Session
import must stay within main's noise, with 5 ms as the example margin.
Report final dist file counts and bytes. Fold the result into the review-fix
SHA for the orchestrator's short Cloud confirmation.

The workspace orchestrator chooses D on 2026-11-19 after the fresh options
check. The Babel traversal dependency is CommonJS. It can load synchronously
only when a JavaScript PnP state needs parsing. A remains the Small fallback
if this dependency boundary fails the source checks. The options report is
`cold-loading-options-check.md` under the context directory. Main already
loads the Babel parser, so the unused new dependency is Babel traversal.

Shared assumptions: current output, bounds, formats, supported native routes,
and the no-new-process rule remain task requirements. Existing preparation
may become the lazy boundary; whether it suffices is a source audit, not an
assumption that permits widening the change.

### 8. Bound overlapping PnP root checks

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Review.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/pnp-locations.ts` and `package-folders.ts`.
- **Background:** Native PnP selects a package reference for the importer. The current catalogue keeps every reference of the requested name.
- **Problem:** An unused outer root adds folder checks to an ordinary exact selection from an inner root. A preferred sibling then ends reuse unnecessarily.
- **Impact if no action:** Some ordinary PnP imports gain extra compiles. Output stays correct.
- **Root question:** How can native output stay correct while ordinary PnP reuse avoids unreachable folder checks?
- **Options:**
  - **A.** Filter the pinned catalogue to reachable dependency references around the importer, the top-level package, and the fallback pool. Keep a sound superset. Overlapping reachable roots can still add conservative checks. Effort: Medium.
  - **B.** Model exact native PnP ownership, including raw locations, duplicate keys, aliases, discard flags, ignore patterns, and fallback exclusions. A wrong parity rule can drop real candidates. Effort: Large.
  - **C.** Obtain package ownership directly from native compilation. The pinned esbuild interface exposes no such result, so this needs a fork or upstream integration. Effort: Large.
  - **D.** Drop an unplaced root's folder checks when another root places the selection. A false placement miss can then omit the real owner's checks. This does not fix the confirmed layout, where both roots place the module. Effort: Medium.
  - **E.** A, while retaining the PnP state-file observation when narrowing removes a matching folder root. This keeps registry-only owner changes visible. It keeps existing reads and bounds. It requires a narrow private-table protocol clause. Effort: Medium.
- **Left out:** Deepest-root selection can miss an outer mapping into an inner package. Refusing the marker keeps the same performance defect. A resolve on each hit breaks the reuse contract. Running project PnP code changes the parser policy. No change keeps the confirmed regression.
- **Wider fix:** C with the registry observation of E. B must preserve exact parity or fall back to A at each unclear step.
- **Previous examples:** Review findings 2 and 5 show package-root qualification and the unused nested-root regression.
- **Recommendation:** E, changed from A by the fresh options check. The native proof confirms that registry-only owner changes need the retained state-file observation.
- **Action:** fix now, apply E.

The performance orchestrator chose A on 2026-11-20 under the user's delegation.
Reliability comes first, then speed. A sound superset cannot omit a real
folder candidate. B can return stale output if one parity rule is wrong.
C is not available through the pinned interface.

This is a narrow exception to unchanged reuse: ordinary PnP reuse can retain
conservative folder checks when two reachable roots overlap. Record the
exception in the owning protocol. Add a follow-up with B and C and a method
to measure the frequency of that layout. The existing metadata, evidence,
wire, and disk bounds remain. Both owners use the same reachable-root filter.
The fresh check of review finding 5 proposed this filter as option D.

The fresh plan check is
`.context/package-folder-resolution-evidence/overlapping-pnp-options-check.md`.
It adds D and E. D can drop a real candidate after a placement miss, so it
does not preserve the chosen sound superset. The native public proof is
`round-2-reachable-registry-proof.ts` and its log in that context directory.

The performance orchestrator extended the call to E on 2026-11-20. E replaces
A alone. Filtering can remove the only observation of the registry that
selects the owner. Both full and marked reuse must keep that state-file
observation whenever the filter removes a matching folder root. A registry
change must end reuse, while an irrelevant sibling in the removed root must
not. Correct output comes first. E adds no read and keeps the same bounds.
Record this private-table exception beside the overlap exception. The
overlapping-root follow-up names C with the registry dependency as its wider
fix. No-folder compiles must keep the time and memory cost goals.
The reachable index must cover the actual second resolve start from
`packageDirectory`, or preserve a sound superset for that start. Both owners
share the index. It keeps duplicate entries, aliases, top-level targets, and
fallback-pool targets without copying native exclusions.

### 9. Remove unused marked-discovery work

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/package-folder-lookups.ts` and its physical reader.
- **Background:** The marked pass walks the whole native graph. Most edges cannot reach a package map. Ordinary results retain no folder table.
- **Problem:** A valid component profile shows extra edge interpretation, repeated root work, and capture allocations before the pass returns an empty table.
- **Impact if no action:** A catalogue without a folder-map selection pays extra edit time and temporary memory.
- **Root question:** How can ordinary compiles keep main's cost while preserving every possible folder-map observation?
- **Options:**
  - **A.** Test effective request eligibility before physical selection. Remove repeated root, placement, and canonical-path work within the existing owners and budgets. Borrow valid configuration scopes. Create candidate observations only when a folder description needs them. Use the physical comparison without unused capture caches. Effort: Medium.
  - **B.** Keep the whole pass and memoize its repeated selections and roots within the existing owner bounds. This retains more temporary state and still visits unrelated edges. Effort: Medium.
  - **C.** Get exact package-map routes from native compilation. The pinned interface exposes no such result, so this needs upstream integration. Effort: Large.
  - **D.** A, plus one shared effective-request walk for the post-compile recorders. Keep each recorder's eligibility and failure state. Compute the generated entry path once and make the ownership predicate cheaper. Run folder classification only while the marker can still result. Effort: Medium.
- **Left out:** Keeping the measured cost fails the performance call. Dropping unproved folder routes can return stale output. Raising bounds, adding a process, or resolving each hit breaks the task.
- **Wider fix:** D, changed from A after the options check. The shared edge owner gives each recorder the effective request before physical selection.
- **Previous examples:** The cold optional traversal import of item 7 added work to every worker. Lazy ownership removed that cost.
- **Related:** The shared package-location fix must keep both link forms and E's registry dependency. A fast eligibility check must preserve non-bare aliases that become package requests.
- **Recommendation:** D, changed from A after the paired residual measurement. Keep A and share the effective-request walk without changing either consumer's observations.
- **Action:** fix now, apply D.

This is the workspace orchestrator's call of 2026-11-20. The performance
orchestrator requires the no-folder mapped-lookups span to return to main's
level. Existing metadata snapshots and bounds remain the owners of any
classification cache. Alias, internal-import, link, and PnP routes keep the
same shared description. No public field, disk format, render key, native
operation, or accepted marked exception changes.

Shared assumptions come from the task and the performance orchestrator's
calls: correct native output, memory within 2%, timing within noise, unchanged
bounds, and no new process, attempt, retry, timeout, or hit-time resolution.
The profile evidence is `review-r2-component-profile/` in the context folder.
Its observer overhead is diagnostic and is not acceptance timing.
The fresh options check is `ordinary-cost-options-check.md` in that folder.
It confirms that A must remove per-lookup work as well as excess selections.
It adds D and ranks D as the wider fix. Measure the combined source before
deciding whether D is needed. No permanent operation-count test is added.

Workspace orchestrator call of 2026-11-20: apply the conditional D refinement.
Six alternating uninstrumented component pairs show a repeatable no-folder
marked-check cost after A. Preserve A's refresh barriers and scalar-name fix.
Share request interpretation while keeping each consumer's eligibility,
failure, staging, and bounds. The component evidence is
`component-timing/final-9A-pairs-20261120T055510.088112Z/` in the context folder.

### 10. Bound folder descriptions before retaining candidates

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/package-folder-maps.ts`.
- **Background:** The shared description collects folder targets and their main-field candidates. The marked recorder applies its existing table allowance afterward.
- **Problem:** Repeated folder targets and repeated main-field strings can multiply retained candidate strings before that allowance applies. Cached metadata reads do not bound this array.
- **Impact if no action:** Unusual bounded manifests can make the sidecar consume excessive memory before it refuses reuse.
- **Root question:** How can folder discovery keep its existing memory bound throughout candidate collection?
- **Options:**
  - **A.** Collect unique candidates as they are emitted. Reserve their eventual parent, base, and manifest rows against the existing allowance before retaining them. Scope or release discarded-owner reservations. Effort: Medium.
  - **B.** Replace materialized descriptions with a repeatable candidate iterator. Stream placement and observation through both consumers under their current bounds. This changes the shared description API more broadly. Effort: Medium.
  - **C.** Refuse large map arrays before expansion with a separate count limit. Duplicate-heavy maps can then lose reuse while their unique table fits. Effort: Small.
- **Left out:** C changes the existing refusal rule and adds a limit, while A keeps the current allowance. Dropping targets breaks the shared evidence superset. A larger allowance violates the memory requirement.
- **Wider fix:** A. The shared description bounds each retained candidate before retention, including forced remaps and merges.
- **Previous examples:** The existing marked table uses a unique-path charge before staging rows. Metadata and inspected paths already have bounded owners.
- **Recommendation:** A. Apply the existing eventual charge at collection time without adding a bound or changing native output.
- **Action:** fix now, apply A.

Workspace orchestrator call of 2026-11-20: keep candidate materialization
inside the existing table allowance. The source audit confirmed the late-bound
cross-product. Do not run an OOM experiment. A discarded owner must not consume
the selected owner's allowance or change ordinary reuse. The shared reader
and all existing metadata, path, table, and frame limits stay unchanged.
The performance orchestrator approved this call on 2026-11-20. The user's
first rule forbids any change that can exhaust the machine's memory. A bounded
regression must keep duplicate-heavy fitting tables within the existing charge
and withhold the marker cleanly when that charge is reached.

Shared assumptions come from the task and the existing folder protocol:
native output, the same candidate superset, unchanged reuse below the existing
bounds, and no new field, kind, ceiling, process, or native operation.

The fresh `candidate-bound-options-check.md` kept A and added optional D,
a two-pass description. A remains the one-pass choice. The check grades the
complete preservation work Medium. The full PnP audit has no staged table:
it must stream the same candidates for placement and a presence fact without
retaining a list or applying the marked row allowance. This keeps the full
record's existing bound. Each marked scope keeps its exact row reservation.

### 11. Refuse unclassified imports at the depth bound

- **Severity:** High. **Likelihood:** Rare. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/package-map.ts:28`.
- **Background:** The package-map walker has an existing depth limit of 32. Tolerant traversal skips deeper values before a folder key is matched.
- **Problem:** An exact internal imports key can hide a bare folder remap below 40 active conditions. The skip keeps an empty marker without observing the installed folder.
- **Impact if no action:** A preferred file added after capture keeps stale marked output. This is a route of the original folder class, not a capture race.
- **Root question:** What must marked reuse do when the existing depth bound prevents imports-target classification?
- **Options:**
  - **A.** Keep depth 32. Withhold the marker when imports traversal reaches it before classification finishes. Deep ordinary internal imports also lose reuse at that bound. Effort: Small.
  - **B.** Replace imports recursion with a bounded iterative walk under the byte and table allowances. This removes its depth-32 bound and preserves deep ordinary reuse. Effort: Medium.
  - **C.** Defer the route as a goal exception. It stays stale on main and the branch. Effort: Small.
- **Left out:** Raising depth only moves the hole. A selected-file shortcut cannot prove the package owner. Native route capture needs a larger integration.
- **Wider fix:** A. A classification that its bound stops cannot certify a marker. B removes one cutoff but changes a bound for a rare layout.
- **Previous examples:** The metadata-limit call already withholds unproved markers at the existing file and aggregate byte bounds.
- **Recommendation:** A. Preserve output and all bounds. Nothing changes below the depth limit.
- **Action:** fix now, apply A.

Performance orchestrator call of 2026-11-20: A under the user's delegation.
The same metadata-limit rule applies to depth. Correct output and unchanged
bounds outrank reuse in a layout that real catalogues almost never have.
B changes a bound for a rare case. C leaves the original stale class open.
The full internal-import capture remains incomplete as before.

Shared assumptions are native output, unchanged bounds, no extra native
operation or process, and unchanged below-limit reuse. The exact proof is
`9D10-deep-remap-proof.mts` with its log in the context folder. Root's main
control, `9D10-deep-remap-main-proof.mts`, fails the same old-key assertion.
Both first results keep an empty marker. Fresh native output is preferred.
The same fresh options check confirms A. The completion rule also covers
a forced exports walk reached through an imports folder remap. Non-forced
exports retain their existing rule. No bound changes.

### 12. Finish with one measured allocation round

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/metafile-edges.ts` and ordinary package-map matching.
- **Background:** The corrected branch passes its public flows and restores. Repeated component pairs still show extra marked-check work without a selected folder mapping.
- **Problem:** The shared request walk and map traversal allocate temporary strings and arrays that ordinary compiles do not need.
- **Impact if no action:** A planned compile pays approximately 35 additional milliseconds in the measured component.
- **Root question:** How much further performance work belongs in this correctness fix?
- **Options:**
  - **A.** Run one Small allocation round. Defer input path splitting, avoid unnecessary extension strings, and narrow key work only where candidate, error and read-set rules stay. Then stop optimizing. Effort: Small.
  - **B.** Continue until the marked phase equals main. This delays the correctness fix and can require wider metadata ownership changes. Effort: Large.
  - **C.** Ship the measured correct branch without another allocation round. Retain its measured extra cost. Effort: Small.
- **Left out:** Dropping folder checks or changing bounds violates correctness or memory requirements. A new setting, retry or native operation remains forbidden. A cross-compile request-result or selected-owner cache breaks the no-new-cache rule and risks the memory bound.
- **Wider fix:** None in this branch. Any remaining shared-walk work gets a separate follow-up when the measured residual exceeds about 15 milliseconds.
- **Previous examples:** The lazy optional-parser load removed its cold worker cost. The shared walk removed duplicated ownership work but retained a measured allocation cost.
- **Recommendation:** A. Take the known Small reductions, then finish the correctness fix with the measured cost named.
- **Action:** fix now, apply A.

Performance orchestrator call of 2026-11-20: one final Small allocation round,
then stop regardless of the remaining cost. Accept an additional marked-check
cost of about 15 milliseconds or less per compile. Above it, still ship the
correctness fix and record the residual and owner profile in a shared-walk
follow-up. Correctness matters more than approximately 35 milliseconds per
compile, about 1.4% of a real cloud edit. Memory within 2%, the cold check,
all bounds, the imports-depth rule, and full audit streaming remain required.
Open the PR only after the parent's final confirming result.

Shared assumptions are unchanged native output and reuse rules, no new
cache or resource ceiling, one Small round, and complete validation afterward.
The current owner evidence is `current-cost-profile.md` in the context folder.
The final allocation change does not narrow branch traversal. It uses pure
selection work and preserves ignored branches and their existing errors.
The fresh `final-allocation-options-check.md` confirms A and all pure
shortcuts. It adds no option or scope change. Optional further reductions
stay out because the one-round stop has been reached.

## Milestone 1: Documentation and contract audit

Depends on: none

Confirm that the existing rules already require current package selection.
Keep protocol rules unchanged. Add useful entry-point context only if needed.

- [x] Read the contract owners and confirm the fix preserves their requirements.
- [x] Audit the README for any entry-point change. Update it only when needed.

Evidence: `.context/package-folder-resolution-evidence/contract-audit.md`.

## Milestone 2: Native route audit and shared fix

Depends on: 1

Audit esbuild 0.28.2 and reproduce each confirmed gap before implementation.
Keep the source audit and failing runs under `.context/package-folder-resolution-evidence/`.

- [x] List every inexact `exports` and `imports` route with esbuild source lines.
- [x] Confirm installed, linked, self-package, and aliased-self selection roots.
- [x] Cover native PnP physical roots and embedded-state forms through a bounded registry catalogue. Prove non-folder reuse and non-PnP operation counts stay unchanged.
- [x] Confirm dependency-import plan replay, duplicate keys, and percent-decoded targets with native evidence.
- [x] Reproduce the marked `serveEdit` lead and report its scope to the performance orchestrator before changing that route.
- [x] Add failing regression cases at the lowest public boundary for the confirmed gaps.
- [x] Fix the shared walkers through the existing candidate owner. Preserve unrelated reuse decisions.
- [x] Cover arrays, condition objects, non-identity mappings, and nested main-field candidates of mapped folders.
- [x] Confirm that an internal `imports` folder mapping still prevents reuse and storage through the existing incomplete-evidence rule.
- [x] Prove in-process reuse, disk restoration after restart, and strict build select the preferred file.
- [x] Prove an unrelated file leaves reuse available. Inspect the named real-world package manifests.
- [x] Run targeted tests. Repeat new asynchronous tests ten times. Record their cost and failing assertions.

## Milestone 2a: Marked folder protocol

Depends on: 1

Record the performance orchestrator's marked-rule call before marked code changes.

- [x] Update the owning recipe protocol for live observations of package folder-map selections only. Keep the other marked rules.
- [x] Run the fresh options check over design item 3 and merge its result.

Evidence: `.context/package-folder-resolution-evidence/marked-protocol-report.md`
and `marked-options-check.md`. The check kept B. A known folder selection that
cannot be represented loses the marker. Other selections gain no refusal.
One shared description owns key and target interpretation for both recorders.

## Milestone 2c: Private folder observation protocol

Depends on: 2a

Record the private-table rule before its marked predicate changes.

- [x] Update the recipe protocol for bounded folder file observations in marked private evidence, with unchanged fields and disk storage rules.
- [x] Run the fresh options check over design item 6 and merge its result. Merge the item 4 and 5 checks too.

## Milestone 2b: Shared marked folder observations

Depends on: 2, 2a, 2c

Use the same folder-candidate description for full capture and marked checks.

- [x] Add red-first marked tests for the self-package recipe, a non-identity mapping, and unrelated-file reuse.
- [x] Audit marked `imports` folder mappings and internal package remaps. Add a red-first case for each confirmed gap.
- [x] Add only folder-map candidates and their defining metadata to marked live inputs through the shared description.
- [x] Store only bounded folder file observations in private marked evidence. Reuse the physical comparison in TS and Rust. Preserve public render metadata and logical module-name rules.
- [x] Prove main/main controls and main/branch document-key and published-index equality for a folder fixture. Prove ordinary marked tables stay empty and reusable, and oversized or dropped folder tables remove the marker.
- [x] Keep the other marked entry-target forms deferred unless the shared description covers them without extra work. Test and update the follow-up if it does.
- [x] Repeat the new asynchronous tests ten times and verify unchanged output for fresh native results.
- [x] Add red-first oversized ordinary-manifest refusal and below-limit ordinary marked-reuse cases. Verify the full-owner boundary and each affected route.
- [x] Preserve ordinary marked reuse for non-object metadata and a malformed higher package copy that native resolution does not select. Keep full parsing, I/O failures, and bounds unchanged.
- [x] Remove the temporary protocol status line after the marked rule is implemented.

## Milestone 3: Measurement and smoke verification

Depends on: 2, 2b

Measure the fix against current `main` on the real `mokly-cloud` catalogue.
Save raw results and the before/after table under the context directory.

The performance orchestrator's instruction of 2026-11-19 permits local
measurements only on fixtures that fit the unchanged 1,750,000 KiB harness
stop. Report each excluded catalogue and its reason. Do not build a prewarm
workaround or increase the stop. Push after the complete gate passes, before
the performance acceptance. The performance orchestrator then measures
`mokly-cloud` with the cgroup harness and compares every view's public keys.

- [x] Compare startup, normal edits, peak memory, and operation counts with balanced runs.
- [x] Report marked-discovery metadata margins on cloud, the example, and the existing large fixtures. Confirm real cloud edits retain the marker and reuse.
- [x] Confirm memory stays within 2% and measure timing against the final acceptance call. Record any accepted marked-check cost. Investigate other failures before acceptance.
- [x] Confirm native output and unaffected catalogue output. Record identity changes separately when the toolchain requires them.
- [x] Compare every view's document keys on cloud and the example against main. Permit only per-run fields proved by the main/main control.
- [x] Run the strict example build and smoke the served catalogue after the final build.

Evidence: `.context/package-folder-resolution-evidence/final-cloud-confirmation-report.md` records the final exact-main comparison and the performance orchestrator's acceptance of the measured restore cost. The performance orchestrator accepted the comparison on 2026-11-20. He accepts the measured restore cost for correctness and reads the remaining startup difference as noise.

## Milestone 3a: Second review fixes and ordinary cost

Depends on: 2b

Keep package resolution paths separate from physical observation paths.
Fix the two confirmed link cases and the unreachable PnP root case together.
Profile no-folder restore and planned compile work before the final cost call.

- [x] Record the approved reachable-root exception in the protocol. Add the overlapping-root follow-up.
- [x] Run the fresh options check for design item 8 and merge its result.
- [x] Run the fresh options check for design item 9 and merge its result.
- [x] Prove the registry-only owner-change lead. Settle its state-file observation before changing the private-table exception.
- [x] Add red-first full and marked registry-only owner-change regressions. Retain the unused-outer-root regression and record the E exception in the protocol and follow-up.
- [x] Add red-first manifest-link, selected-file-link, and ordinary nested-PnP reuse regressions with native and unrelated controls.
- [x] Implement the shared package-location record and physical matching for folder candidates. Keep ordinary mapped matching unchanged.
- [x] Return an unplaced known-folder result when no candidate proves placement. Preserve existing ordinary and unreadable-configuration behavior.
- [x] Share the reachable-reference filter between both evidence owners. Keep the approved overlapping-root exception and unchanged bounds.
- [x] Profile one Cloud-sized restore and planned edit per arm. Name the measured ordinary-path cost owners.
- [x] Attribute cold React sidecar memory after fresh capture, restore, and planned edit in both arms. Separate retained owner bytes from temporary allocations.
- [x] Remove the remaining repeated-root and target work under 9A. Measure the uninstrumented residual before deciding on 9D.
- [x] Apply conditional 9D through one shared effective-request walk. Preserve 9A's refresh and read-set barriers. Measure the resulting no-folder cost.
- [x] Bound shared candidate descriptions during collection with the existing staging allowance. Keep duplicate-heavy fitting tables reusable and discarded owners independent. Add the approved bounded regression without an OOM experiment. Run the fresh options check for design item 10.
- [x] Keep the full PnP audit streaming and free of the marked reservation. Prove full reuse below its existing bounds when the marked estimate exceeds its allowance.
- [x] Apply the approved depth-bound exception for internal imports and their forced remaps. Add the red-first 40-condition refusal, forced-walk refusal, and below-limit ordinary-reuse control. Run the fresh options check for item 11.
- [x] Verify the final README and metadata-limit protocol against the completed depth and streaming-audit behavior.
- [x] Complete the one approved Small allocation round. Run its fresh options check, measure the residual, and stop optimizing. Add the shared-walk follow-up only if the residual exceeds about 15 milliseconds.
- [x] Prove that a later repeated package name cannot impersonate a self-package owner. Keep the native first-name rule in marked qualification and the full-capture superset.
- [x] Repeat affected async regressions ten times. Recheck owner, identity, PnP, metadata and table-bound proofs.
- [x] Run the complete gate, smoke checks, and final paired cost measurements. Commit and push one SHA for parent confirmation.

Evidence: `.context/package-folder-resolution-evidence/review-r2-implementation-report.md`
maps the approved source changes to their red and green checks.
`review-r2-component-optimized/` holds the first component profile of those
changes. The ordinary-path cost remains open.
`retention/REPORT.md` and `retention/comparison.json` hold the retained-owner
diagnostic. The final whole-tree memory comparison remains required.
`approved9A-refinement-report.md` records the refresh barriers, repeated-name
regression, final source hashes, targeted checks, and ten repetitions.
`audit-final-implementation-handoff.md` records the final 9D, bound, audit,
and depth checks. Its frozen dist and source are the measurement artifacts.
`allocation-final-implementation-handoff.md` records the last approved pure
allocation round and its replacement frozen artifacts.
`final-allocation-options-check.md` confirms its options and stop boundary.
`final-measurement-report.md` holds the concluding local pairs, output,
metadata margins, and exclusions. The accepted residual is recorded in
`plans/follow-ups/marked-request-walk-allocation.md`.

## Milestone 3b: Baseline capture-coherence investigation

Depends on: 2b

The performance orchestrator clarified the scope on 2026-11-20. The original
folder-export class excludes races between compilation and capture. Check each
new race against main before deciding whether it belongs in this fix.

- [x] Prove the post-build file-appearance failure through public bundle and reuse calls. Preserve the unchanged importer and real native results.
- [x] Trace the native and saved-plan lifecycle. Investigate bounded coherence options in a fresh read-only context.
- [x] Check the post-build file, dangling-link replacement, and nearer-PnP-state proofs against main. Confirm each accepts the same stale native result.
- [x] Obtain the performance orchestrator's scope calls before changing any protocol rule. Keep the approved 9A refinement.
- [x] Record each High/Rare baseline case as a self-contained follow-up with its exact proof and options. Add no accepted-race protocol rule.
- [x] Merge the fresh scope options check. State the three remaining stale cases explicitly in the PR body.

Evidence: `.context/package-folder-resolution-evidence/review-r2-post-build-coherence-proof.mts`
and its log preserve the failing public call. `coherence-design-investigation.md`
records the fresh source investigation. `main-baseline-proofs/` holds the three
native main controls and their artifact provenance.

The performance orchestrator chose the following outcomes on 2026-11-20:

- Post-build preferred file: E. Defer the shared capture-coherence race. Keep
  ordered marked checks, proved full checks, timestamps, and pre-compile
  witnesses as options A to D in its follow-up. The fix is Medium and the
  branch introduces no regression.
- Replaced dangling link: A now and C in the follow-up. Preserve current reuse
  now. Pin lexical dangling-link identity through the shared TS/Rust matcher
  later. B stays out because withholding the marker removes working reuse.
- Nearer PnP state after compilation: A. Keep the shared metadata timing and
  record pre-compile witnesses, exact native parity, and timestamps as B to D.

All three cases remain stale on main and on this branch. The shared capture
question needs its own design. These calls change no accepted protocol rule.

The fresh `baseline-coherence-options-check.md` confirms all three main
controls and all scope calls. It adds future ordinary-route, link-kind, and
owner-witness options. The later marked check is Medium. The full-owner lead
did not reproduce, so that half remains conditional. The calls for this
branch stay E, A now with C later, and A.

## Milestone 4: Verification, review, and pull request

Depends on: 1, 2, 2a, 2b, 2c, 3, 3a, 3b

The orchestrator owns these steps. Keep Git 2.45 or later first on `PATH`,
install git-lfs, and use pinned Bun. Use locked Cargo dependencies. Check free
disk and memory before large builds. Disable Cargo incremental and dev debug
information. Give each checkout its own target directory. Run one Cargo build
at a time. Keep workspace 54's changes when current `main` needs integration.
The performance orchestrator held the first confirming comparison on
`c2fe4bf2a`. Its returned result of 2026-11-20 permits one integration of
`origin/main`, including Cloud and Rust 1.98.1, before the final pull request.
Keep the frozen control artifacts for the separate component comparison.

The performance orchestrator changed the final order on 2026-11-20 after the
frozen fix passed its complete gate. Integrate current main before the last
Cloud comparison. Preserve both sides, run targeted tests and the repository
suite, then push at once. The complete matrix runs in CI. The parent uses
exact main `a16a623e6` as its control. The parent also authorized the one-line
`compile_count: 1` fixture correction of pending PR #411 when that merge
exposes the known main compile error.

- [x] Run targeted tests, `cargo xtask check --suite repository`, and `cargo xtask check`.
- [x] Align the existing Node malformed-marker case with the approved file table. Keep the flag, toolchain, and invalid-kind assertions. Repeat the changed async case ten times and rerun the complete gate.
- [x] Check and fix review findings 1 and 2 through one shared mapping-description change. Keep ordinary exact, alias, link, self, PnP, and configured-path reuse contrasts. Preserve read-only final classification.
- [x] Run the fresh options check for item 7 and merge its result. Audit synchronous call sites within the approved Small scope.
- [x] Defer the optional parser dependency and repeat the same cold-worker diagnostic.
- [x] Run the complete gate on the combined review fixes and integrated current main. Audit the entry-point documentation after the shared root description changes.
- [x] Commit with Conventional Commits and push. Send the implementation SHA to the performance orchestrator.
- [x] Review the full diff against `origin/main` with `implementation-review` after the push. Check new findings. Apply up to two fix rounds. Record follow-up items for remaining findings. Re-review once.
- [x] Integrate the final current main once under the updated parent order. Keep folder, stylesheet, base-reuse, and render-store inputs. Run targeted tests and the repository suite. Push the merged SHA for exact-main Cloud confirmation. CI owns the complete merged matrix.
- [ ] Delete this plan after every other required TODO passes and review rounds finish.
- [ ] Open the pull request against `main`. Preserve this plan's dated calls and permalink in its description. Watch CI with the finish-work script. Fix branch failures. Report results to the sending session. Do not merge.

Evidence: `.context/package-folder-resolution-evidence/main-review-integration-audit.txt`
and `main-review-integration-preservation.patch` record the clean integration
of current main before the review-fix delegation.
The final delegated checks and smoke evidence are in
`review-fix-round-1-report.md` and `review-fix-smoke-report.md` in that context
directory.

Final integration evidence: `.context/package-folder-resolution-evidence/final-main-product-integration-report.md`, `final-main-docs-merge-report.md`, `final-main-merge-preservation.patch`, `final-main-repository-fixed-result.json`, and `final-main-targeted-results.json`.
