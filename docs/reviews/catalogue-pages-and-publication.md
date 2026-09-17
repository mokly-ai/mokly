# Catalogue Pages And Publication Review

## Scope And Outcome

`cargo xtask review` completed on 2026-09-09 after commit `709151a` was
pushed, reviewing the complete committed diff against `origin/main` at
`93ac778`. This was invocation 2 of the maximum 10; invocation 1 was interrupted
after the post-push mainline audit detected new main changes, before any final
findings. The implementation commit is `57eb59a`.

The original route-contract and review-record findings were validated and
resolved before implementation. The final review raised four additional valid
findings. Item 4 was resolved by final documentation bookkeeping in `751499e`.
The user subsequently authorized fixes for items 1–3; all three were reproduced
with regression tests and the recommended fixes are implemented. Verification
and the subsequent post-push review are recorded below. The original review
completed with findings.

The post-fix review of `aa1c523` completed with three additional valid findings.
The user subsequently authorized those fixes as well. All three were reproduced
or checked against the implemented API, and their resolutions are recorded below.

## Findings

1. **High — imports outside `repoRoot` escape the source inventory. Resolved.**
   [The shared graph classifier](../../src/build/source_inventory.ts) silently
   skipped executable inputs outside the repository. Independent probes confirmed
   that an entry helper outside `repoRoot` changes generated HTML without
   changing `sourceFiles`; an outside config helper is also accepted and omitted.
   This broke the [complete inventory contract](../protocol/mokly-source-protection.md):
   watch, freshness, and publication consistency checks could not account for those
   authored inputs. Options: **A.** Reject outside source inputs at the shared
   graph boundary after excluding the package runtime and installed dependencies;
   add config, entry, renderer, and page-helper regressions. **B.** Expand the
   repository root automatically. **C.** Allow and document the omission.
   **Recommended and applied: A.** One fail-closed rule protects every graph consumer; B changes
   the ownership boundary implicitly and C leaves the incomplete-inventory bug.
   All non-exempt graph inputs now reach the shared strict repository validator.
   Regression tests cover config, entry, renderer, transformer, page, and raw
   template imports, plus continued support for outside installed dependencies.

2. **Medium — a symlinked `.context` can publish outside the repository. Resolved.**
   [Preview output validation](../../scripts/preview/catalogue.mjs) confined
   the output to the resolved context directory without confining that directory
   to the real repository root. A disposable probe successfully published an
   `index.html` outside its configured `repoRoot`. Existing ownership-marker
   checks protected unowned existing directories, but new output could escape.
   This pre-existing weakness remained after the initial nested-symlink checks.
   Options: **A.** Require both resolved `.context` and output to remain within
   the real repository root, retaining ownership and nested-output checks;
   cover context-root and nested-parent symlinks. **B.** Reject all symlinked
   `.context` directories. **C.** Document a non-symlink precondition only.
   **Recommended and applied: A.** A shared canonical-root invariant covers ancestor escapes
   while preserving legitimate in-repository symlinks.
   Both publication options reject context, parent, and output escapes before
   writes, even for marked output; tests also prove valid in-repository symlinks
   and a symlinked repository root remain supported.

3. **Low — common shell copy still describes screens only. Resolved.**
   [Search accessibility and placeholder text](../../packages/viewer/src/shell/document.tsx)
   said “Search screens”; [home and missing-route copy](../../packages/viewer/src/shell/views.tsx)
   omitted whole-document pages. Users searching for or opening a document received
   misleading guidance despite its first-class catalogue support.
   Options: **A.** Use catalogue-wide copy in shared shell controls, update the
   owning mobile/desktop mockups, and update shell/browser assertions. **B.**
   Specialize messages only when an entry kind is known. **C.** Retain screen-only
   labels. **Recommended and applied: A, with B where useful.** Shared neutral wording prevents
   the same omission when more entry kinds are introduced.
   Shared search now names the catalogue; home and missing-route guidance refer
   to an item. Known screen/page messages retain their specific wording. Owning
   designs were updated and regenerated before runtime copy; shell, design,
   publication, and mobile/desktop browser assertions cover the result.

4. **Low — documentation labels still said planned/approved target. Resolved.**
   The [README](../../README.md) and [protocol index](../protocol/README.md)
   contradicted implemented delivery statuses, and the README had a stray space
   before a semicolon. Leaving them unchanged would confuse contributors about
   feature availability. Options: **A.** Update feature labels and correct the
   typo in final bookkeeping. **B.** Keep status only in plan files. **C.** Leave
   stale labels until another edit. **Recommended and applied: A.** The plans
   retain the dated delivery and review history; feature links use stable names.

## Verification And Evidence

The original implementation gate passed: 453 Node tests, 102 Chromium tests,
three Rust tests, formatting, lint, typechecking, package checks, packed
consumers, example freshness, clippy, and Rust file-length checks. The independent
review ran read-only inspection and `git diff --check`; it did not rerun the
build-writing test suite. All 60 design artifacts were visually inspected.

The Accounting rehearsal and its preservation checks are recorded in the
[consumer note](../migration/accounting-page-entries.md). Its compiled package
matched the originally reviewed runtime. That tarball predates these follow-up
fixes; durable adoption must use and validate the chosen package version.
Durable adoption and npm publication remain separate.

Reproductions for findings 1 and 2 use only disposable fixtures and clean them
up afterward. Their script, results, original review output, and verification
logs are retained under `.context`; no original consumer files were changed.

## Authorized Follow-Up

The failing regressions captured all six outside authoring-import cases, the
context-root escape in both publication options, and both responsive design and
runtime copy. Focused verification passed 46 Node tests, 34 browser tests, and
typechecking. The full `cargo xtask check` passed with 469 Node tests, 104
Chromium tests, three Rust tests, formatting, lint, package/packed-consumer
checks, example freshness, clippy, and the Rust file-length audit.

All 52 changed design artifacts were opened directly from disk and visually
inspected, plus the live home, document, and missing-route views at both widths.
All 163 local Markdown link targets resolve. The fresh mainline audit found no
additions beyond `93ac778`; no new deletions were introduced. Logs and visual
evidence are retained under `.context/review-fixes-*`.

Fix commit `aa1c523` was pushed to `calummoore/same-name-roots` before the next
`cargo xtask review`, which completed against `93ac778`. This was invocation
3 of 10 overall and the first for these fixes; two reviews completed and the
first invocation was interrupted. The original findings were not re-raised.
The reviewer performed read-only inspection and a clean committed whitespace
check; its sandbox prevented a temporary-file smoke probe, so runtime evidence
comes from the full gate and independent disposable probes.

A separate documentation audit confirmed that the example's `theme.ts` appears
in the real source inventory and receives automatic rebuilds. Final bookkeeping
corrects the stale README instruction to restart after editing that helper.

## Review After aa1c523

All three findings were independently checked and their recommended fixes were
authorized by the user. They are resolved as described below.

1. **Medium — public manifests expose the source-file inventory. Resolved.**
   The [public asset classifier](../../src/config/public_files.ts) permitted
   `mokabook-manifest.json`, and publication copied it into `static/`.
   A disposable probe confirmed a live HTTP 200 and published JSON containing
   an imported `mockups/private/renderer-helper.ts` path. Its source contents
   remained protected: the helper returned 404 and was not copied. The issue
   exposes internal file names and structure, without exposing file contents.
   Options: **A.** Keep the on-disk manifest for builds and Git comparisons but
   classify it as internal across public HTTP, export, and Review resource reads;
   cover direct requests, aliases, and both publication options. **B.** Publish a
   separate sanitized catalogue manifest. **C.** Explicitly support the complete
   inventory as public metadata. **Recommended and applied: A.** Browsers already receive their
   needed catalogue data through the shell, and one shared classification rule
   avoids inconsistent exclusions. Choose B if a public metadata consumer needs it.
   A shared internal-metadata policy now protects canonical and historical
   manifests and their aliases in HTTP, publication, generated references, and
   current/historical Review reads. Internal readers and ordinary public JSON
   remain supported. A stale historical alias cannot block unrelated resources.

2. **Medium — publication fingerprints miss an earlier manifest change. Resolved.**
   [The publisher](../../scripts/preview/catalogue.mjs) read a manifest before
   its initial fingerprint; [the server](../../src/server/http.ts) read it again.
   A probe added a page after the first manifest read but before the fingerprint
   read its inputs. Publication succeeded with matching fingerprints and a new
   navigation link, but without that page's captured view or ID redirect.
   Leaving this unchanged permits a mixed snapshot with broken navigation.
   Options: **A.** Begin fingerprinting before reading the manifest and add an
   ordering regression. **B.** Use one validated publication snapshot for the
   server, capture loop, change metadata, and redirects, with fingerprint checks
   bracketing its reads and capture. **C.** Lock builds and publication together.
   **Recommended and applied: B, including A's ordering correction.** Removing the second
   independent manifest read prevents future divergence between these consumers;
   A alone repairs the demonstrated race with less API work.
   Input capture now hashes the exact manifest bytes used to construct one
   validated snapshot shared by the capture server, page list, resource
   adaptation, Changes, and redirects. Both publication options verify the
   fingerprint before installation and preserve previous output on failure.
   Inventoried helpers under `.context` remain included; canonical stage/output
   exclusions keep legitimate in-repository directory aliases working.

3. **Low — the package protocol retains obsolete legacy guidance and omits pages. Resolved.**
   The [package contract](../protocol/mokly-package.md) described legacy
   `exclude` values, although config validation rejects the `legacy` key. Its
   public API and tags summaries omitted page helpers even though `PageInput` accepts
   tags and both page authoring forms are supported. This gives upgrading consumers
   contradictory configuration guidance and an incomplete feature reference.
   Options: **A.** Remove obsolete config guidance and audit the public API/tags
   summaries against current exports, linking page-specific detail to its owning
   spec. **B.** Consolidate the duplicated authoring reference into dedicated
   entry-kind docs and keep historical behavior only in migration guidance.
   **Recommended and applied: A.** One complete contract audit addresses the related omissions
   without requiring a broader documentation reorganization.
   The contract now documents legacy-key rejection, both page authoring forms,
   the page exports, and page tags, with links to the owning page specification.

The snapshot-race and manifest probes use disposable fixtures and clean them up.
Their script and results are retained as `.context/review-fixes-validate-new-findings.mjs`
and `.context/review-fixes-new-findings-validation.json`. They changed no tracked
implementation files and do not replace regression tests for future fixes.

## Second Authorized Follow-Up

The initial regression run failed all 12 metadata/publication cases. An
additional context-helper regression exposed an incomplete initial digest and
drove exact-byte manifest capture. The final focused run passes 32 tests,
including both publication options, historical metadata readers, snapshot
mutation and rollback, in-repository aliases, and watcher recovery.

Fetched main `a5ecbc0` was audited from the captured source tip `e332110` before
integration. All new main files and material Changes/resource-watch behavior
are retained. Material content/resource filtering now also handles pages;
historical resource validation uses the baseline's source inventory. Existing
main regressions exposed and cover dangling-resource ownership recovery.
The mainline additions and preservation audit are retained under `.context`.
Only the three already approved legacy/removal files are deleted against main.

Two updated desktop design artifacts and their mobile variants were generated
from their owning source, opened directly from disk, and visually inspected.
The full `cargo xtask check` passed with 544 Node tests, 104 Chromium tests,
three Rust tests, formatting, lint, typechecking, package and packed-consumer
smoke checks, current example output (70 files), clippy, and the Rust file-length
audit. Final bookkeeping also validates all 181 local Markdown targets across
24 changed documents.
Fix commit `3eae8be` was pushed before `cargo xtask review` invocation 4 of 10
overall. The review completed against `a5ecbc0` with four new findings; the
three requested findings were not re-raised. Independent probes confirmed all
four, with the impact qualifications below. Under the repository's review rule,
these new items were reported for user selection.

## Follow-up Review

The four findings after `3eae8be`, their authorized resolutions, and subsequent
verification are recorded in [Catalogue Input And Alias Review](./catalogue-inputs-and-aliases.md).
