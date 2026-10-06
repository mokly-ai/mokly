# Catalogue Input And Alias Review

These findings came from review invocation 4 after `3eae8be` was pushed. The
user authorized all four fixes. Earlier findings and verification remain in
[the catalogue review record](./catalogue-pages-and-publication.md).

1. **Medium — imported asset bytes escape authoring-input tracking. Resolved.**
   [Graph classification](../../packages/mokly/src/build/source_inventory.ts) excluded loaders
   such as `dataurl` before forming the source inventory. A probe imported an SVG
   into a screen title: changing it changed the title from `25` to `72` after a
   manual build, but the asset had no source/resource watch, classified as
   `ignore`, and remained public. This violated the mixed-role source rule and
   left authored output stale during development. Inventory freshness checks
   compare path membership, not file contents; they do not promise to detect
   ordinary edits to an already listed source either.
   Options: **A.** Track imported bytes that affect authoring as protected source
   inputs regardless of asset extension/loader, retaining ordinary URL-referenced
   public resources. **B.** Add a separate inventory for public assets that require
   rebuilding authored output. **Recommended and applied: A**, using the shared graph boundary
   and regressions across loaders/config/consumer graphs. B preserves a broader
   public-asset API but adds a second inventory and conflicts with the current
   mixed-role protection contract unless that contract changes.

2. **Medium — Changes misses edits behind a stable public alias. Resolved.**
   [Resource matching](../../packages/mokly/src/server/changed_resources.ts) compared only logical
   reference routes to Git paths, while the watcher already recorded physical paths.
   Screen and page probes kept `image.svg -> assets/logo.svg` unchanged and
   edited only the target. Both physical/logical paths remained watched and the
   action was `reload`, but `changedRoutes` was empty. Users could miss a real
   visual change in the catalogue filter. Historical comparison readers still
   reject Git symlinks; this finding does not propose weakening that safeguard
   or claim that every such screen can publish a baseline comparison.
   Options: **A.** Match both logical routes and validated physical identities
   from the shared resource reader. **B.** Reject public aliases across build,
   serve, watch, and publication. **Recommended and applied: A**, with target-only edit tests
   for pages/screens and flow propagation. Reuse the reader's confined locations;
   duplicating realpath handling risks inconsistent source and escape checks.

3. **Medium — publication follows unconfined links and drops valid public aliases. Resolved.**
   [Fingerprint enumeration](../../scripts/preview/inputs.mjs) followed unrelated
   symlinks when hashing, while [public copying](../../packages/mokly/src/publication/resources.ts)
   skipped them before applying its public-file guard. Probes confirmed a read of
   a harmless file outside the configured consumer root, failure on an unrelated
   dangling link, and successful publication in both modes with an omitted image
   alias still referenced by the published HTML. The outside bytes entered the
   digest; the probe did not expose them in the artifact.
   Options: **A.** Share confined enumeration with logical/physical identities,
   hash link text, and validate source/public eligibility before reading or
   materializing targets. **B.** Reject symlinks during publication.
   **Recommended and applied: A**, plus exported-reference checks in both modes and coverage
   for source/metadata aliases, escapes, and dangling targets. Fixing copying
   alone leaves the fingerprint boundary inconsistent. The omitted-alias behavior
   also exists on the audited main revision.

4. **Low — CLI and nested-entry documentation remains contradictory. Resolved.**
   The [package contract](../protocol/mokly-package.md) rejected `review` and
   `--out` but still described a Review CLI output override. Parser probes reject
   both `review` and `serve --out`, as the existing CLI tests require. The
   [NestedChild comment](../../packages/mokly/src/authoring/types.ts) also named only screens and
   collections although its union includes pages. Leaving these statements
   misdirects consumers and omits pages from generated API guidance.
   Options: **A.** Correct both statements and link CLI guidance to its canonical
   section, distinguishing the repository preview script's valid `--out` option.
   **B.** Consolidate the duplicated API/CLI summaries into owning references.
   **Recommended and applied: A.** Existing parser tests cover runtime; a blanket flag-string
   lint would confuse the two interfaces. The CLI wording predates this branch;
   the nested-page comment needs updating with the expanded type.

The reviewer inspected the committed diff read-only and passed its whitespace
check; it did not rerun write-producing test suites. The prior review record
supplies its runtime verification. Independent probe scripts/results are
retained under `.context/review-followup-2-{public-alias-probe,input-probes,cli-probe}`;
all disposable consumers were removed and no original consumer files changed.
Items 1–3 share input classification and file-identity concerns. A shared policy
with boundary regressions was implemented after the user authorized all four
items. No new plan was created; completed feature milestones remain complete.

## Resolution And Verification

Imported bundler inputs now reach the same strict inventory boundary regardless
of loader. A shared confined location records both logical and physical paths
for source checks, public HTTP, Review, Changes, watches, and publication.
Changes compares both resource identities without weakening Git snapshot rules.

Publication shares typed enumeration and validated reads for its fingerprints
and static tree. Link metadata is hashed without reading outside/unresolved
targets. Safe public file and directory aliases become regular exported files;
HTML/CSS resource references are checked against the completed staged tree.
The package CLI and nested-child documentation now match their implemented APIs.

The new regression run reproduced 17 failures with two passing controls before
production edits. After the fixes, all 22 focused tests and all 74 existing/new
boundary tests passed, including a live watched-server asset-import smoke test.
The initial `cargo xtask check` passed: 564 Node tests, 104 Chromium tests, 3 Rust
tests, formatting, lint, typechecking, example freshness (70 files), package
checks and packed consumers, clippy, and the Rust file-length audit (10 files).
The real example also published successfully. All 184 local Markdown targets
across 25 changed documents validated.

A stricter confinement regression caught artifact-marker probes through outside
directory links; marker checks now run only after physical confinement. The
final gate also exposed an existing browser-test race between two frame-link
clicks. Adding the missing intermediate URL assertion fixed the scenario; it
passed five repetitions per viewport and the complete browser suite. Runtime
timeouts, retries, and navigation behavior remain unchanged.

Fix commit `984cb6a` was pushed before review invocation 5. That review was
interrupted before final findings when an independent probe found that the new
shared enumeration also applied repository dependency/build exclusions to public
catalogue routes. A page under `target/` could have a captured shell with no
exported document. Eight regression cases reproduced this for pages/fragments
under `target` and `node_modules`, and for wholly omitted documents, in both modes.

The public walk now preserves these valid directory names. Export validation
starts from every current page and light/dark screen fragment in the manifest,
so an omitted document cannot escape validation merely by being absent from the
copied set. All 45 publication boundary tests pass. The final full gate passed
with 572 Node tests, 104 Chromium tests, and 3 Rust tests, plus all formatting,
lint, typechecking, example/package/packed-consumer, clippy, and file-length
checks. The real example publication smoke passed again. Correction `e9047fe`
was pushed before review invocation 6 of 10 overall against `origin/main` at
`a5ecbc0`. That review completed with three findings. Independent probes rejected
item 1 and validated items 2–3, with the qualifications below. The four originally
requested fixes remain resolved; the new valid findings are reported for user
selection under the repository's review rule.

## Review After e9047fe

1. **Medium reported — nested page source attribution is lost. Invalid.**
   The reviewer inferred a missing copy of `definedIn` in
   [page flattening](../../packages/mokly/src/authoring/definitions.ts), comparing it with the
   explicit assignments for screens and collections. The page branch already
   preserves the field through its rest/spread object, `definePage`, and branding.
   The root loader only supplies a fallback when attribution is absent.
   A real helper-authored page nested under a collection compiled with
   `sourcePath: "entries/shared.ts"` and the matching generated ownership header.
   Leaving the implementation unchanged has no demonstrated attribution defect.
   Options: **A.** Retain the working propagation. **B.** Add a redundant explicit
   assignment. **Recommended: A**; the independent build disproves the claim,
   so no production change is justified.

2. **Medium — no-watch startup computes Changes twice and can retain stale fallback routes. Fixed in the follow-up below.**
   [Serve](../../packages/mokly/src/server/serve.ts) precomputes a route list, then
   [HTTP startup](../../packages/mokly/src/server/http.ts) computes a complete catalogue-change
   snapshot again. Ordinarily the second result supersedes the first; duplicate
   work alone does not prove two conflicting snapshots are displayed. However,
   an independent probe removed a page and failed the second Git calculation:
   both calculations ran, `guide.html` remained in the fallback Changes list,
   the removed-page row was absent, and its route returned 404. Doing nothing
   preserves this inconsistent fallback and redundant Git/manifest reads.
   Options: **A.** Construct one validated snapshot at no-watch startup, pass it
   through the server factory, and remove the independent route-list fallback.
   **B.** Let HTTP startup alone own snapshot creation and remove Serve's pre-read.
   **Recommended: A**, with failure/removal and single-calculation regressions at
   the orchestration boundary. This reuses the existing snapshot contract rather
   than adding recovery rules for two partial results. Merely eliminating the
   duplicate calculation does not additionally pin later on-demand comparisons;
   that would require an explicit provider decision beyond this demonstrated bug.

3. **Medium — preserved legacy-page comparison is promised but absent. Fixed in the follow-up below.**
   [The then-current migration plan](../../plans/unified-catalogue-pages.md) requires an
   exact-route historical adapter using the current page's ID and the legacy
   document/source. [Document pairing](../../packages/mokly/src/server/changed_content.ts)
   looks only at historical entries by ID. A validated v3 fixture with a matching
   `legacyPages` route produced no historical-document reads or material paths;
   the new page appeared in Changes through its added metadata. The contract
   explicitly permits adoption to remain changed, so this finding does not promise
   zero Changes after migration. Its missing behavior is historical document,
   paired-ignore, and resource comparison. Separately, the
   [runtime contract](../protocol/mokly-runtime.md) still describes a live legacy
   route-directory tree that the implemented catalogue no longer has.
   Options: **A.** Add a typed route-based historical-page adapter under the
   existing validated baseline boundary, test identical/ignored/material/resource
   cases, and correct the stale runtime paragraph. **B.** Deliberately drop the
   adapter promise and document migrations as added current pages, also correcting
   the runtime paragraph. **Recommended: A** to fulfill the accepted migration
   contract. B is a product/contract reduction, not an equivalent code fix.

The final reviewer ran a read-only diff and whitespace check; it did not rebuild
or rerun write-producing suites. The full gate above supplies that verification.
Three independent probes passed while establishing the validity decisions; their
script, output, and JSON are retained as
`.context/review-followup-3-review-validation.{ts,log,json}`. All disposable
consumers and the temporary server were cleaned up. No product code changed
while evaluating the final findings. No completed milestone was reopened and
no new plan was created.

Final documentation bookkeeping validated 190 local Markdown targets across
25 changed documents. The final code remains at e9047fe; only this review record
changed after the completed review.

## Startup And Historical Comparison Follow-Up

The user requested fixes for the two validated findings above. The invalid
nested-page attribution finding remains unchanged.

1. **Medium — startup snapshot. Fixed, option A.** No-watch Serve constructs one
   validated snapshot from the successfully written compilation and resolves its
   optional Changes once. HTTP receives that snapshot and cannot retry Git or
   reread a later manifest. A shared startup loader retains existing unavailable
   history and fatal manifest-validation behavior for server children too. The
   partial `ServerOptions.changedRoutes` fallback is removed; lightweight watch
   notifications keep their existing route updates. Regression tests reproduce
   the failed second calculation, retain a removed page's row/count/view, cover
   unavailable history, and mutate metadata at the factory handoff. This fixes
   generation ownership rather than adding another fallback. Later on-demand
   screen comparisons retain their existing provider policy.

2. **Medium — historical page adapter. Fixed, option A.** A typed
   page-baseline index maps current IDs to
   v4 page IDs or exact preserved v2/v3 legacy routes. Existing paired-ignore,
   material-content, resource, and historical source-protection rules consume
   those artifacts. Current display metadata stays current, and unmatched legacy
   records still cannot become removed entries. The runtime's stale separate-tree
   paragraph is corrected. Regression fixtures cover both historical versions,
   unchanged/ignored/material/resource edits, one-sided ignore markers, unsafe
   Git files and private source collisions, metadata attribution, and unmatched
   routes. No historical source code runs and pages gain no visual comparisons.

The initial regression run failed 10 of 20 cases on the reviewed code, including
the removed-page 404 and skipped historical material/safety checks. After the
fixes, all 59 focused tests passed. The full `cargo xtask check` then passed:
592 Node tests, 104 Chromium tests, 3 Rust tests, formatting, ESLint,
typechecking, example freshness (70 files), package checks and packed-consumer
smokes, clippy, and the Rust file-length audit (10 files). Runtime tests start
real no-watch servers and exercise removed/current routes; the CLI lifecycle
smoke and watched/published browser coverage also passed. Documentation checks
validated 191 local links across 25 changed Markdown files. The mainline audit
found only the three previously approved deletions and no new removals.
Verification is logged in `.context/review-followup-4-check.log`. The fixes were
committed and pushed as `bdded01` before review invocation 7/10.

## Review After bdded01

`cargo xtask review` completed successfully against `a5ecbc0..bdded01`, with two
findings. The reviewer checked the committed diff read-only and passed
`git diff --check`; the full gate above verifies the reviewed code. Each finding
was then independently checked without changing product code.

1. **High — failed-child cleanup can lose a running process. Valid, pre-existing.**
   [The supervisor](../../packages/mokly/src/server/supervisor.ts) clears its child handle on
   readiness failure or a post-ready error, sends SIGTERM, and does not await
   exit or escalate. A child that ignores termination can outlive `close()`;
   recovery can start another child before the old one releases its port. Three
   boundary probes simulated readiness timeout, pre-ready error, and post-ready
   error: each observed one termination, no shutdown message or force-kill,
   completed `close()`, and a replacement while the original remained alive.
   These probes used test doubles, not an intentionally orphaned OS process.
   The file is byte-identical to `origin/main` (Git blob `52be113ceea7fc2e125b35602f21b7c881f2c482`),
   so this is an existing lifecycle gap, not a regression from these changes.
   Options: **A.** Reuse `stopChild()` on failure paths. **B.** Track terminal state
   and one shared cleanup promise for each child, and require every failure,
   close, and replacement path to await that cleanup, with regression coverage.
   **Recommended: B.** A alone risks waiting for an exit event that already
   occurred. B addresses the ownership and ordering rule across the lifecycle.
   Reported for user decision, then addressed by the authorized
   [watched-child lifecycle follow-up](./watched-child-lifecycle.md).

2. **Medium — nested pages lose helper attribution. Invalid, repeated.**
   [Page flattening](../../packages/mokly/src/authoring/definitions.ts) retains `definedIn` in
   the rest object and spreads it into `definePage`; it does not discard that
   field. A fresh compiled consumer importing a nested page from `entries/shared.ts`
   produced that exact manifest source path and matching ownership header.
   Keeping the implementation preserves correct source metadata; the claimed
   impact does not occur. Options: **A.** Retain the implementation. **B.** Add
   redundant attribution copying or a cross-kind refactor. **Recommended: A**;
   the repeated claim supplies no new evidence or correctness benefit for B.

All four independent validation probes passed; their script, log, and JSON are
`.context/review-followup-4-validation.{ts,log,json}`. The final review output is
`.context/review-followup-4-final-review.md`. The remaining valid concern is child
process ownership during failure recovery. Only this review record changed
after review; no completed milestone was reopened or new plan created.
