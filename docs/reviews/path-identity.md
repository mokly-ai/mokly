# Path Identity Review

This is the final read-only review of the
[path identity plan](../../plans/path-identity.md). It covers the complete
diff of `calummoore/file-paths-vs-navpath` at `74e7596b` against `origin/main`
at `800fe9f8`. Two fresh reviewers followed the
[implementation review prompt](../implementation-review-prompt.md). A Codex
reviewer covered the backend, scripts, data layers, and documentation. A Claude
reviewer covered the viewer UI and the design mockups. The orchestrator then
confirmed each finding, either by reproducing it in a scratch Git repository
or by reading the code. Nothing was changed during the review. The reviewer
also ran the unmodified `cargo xtask check`, and it passed: 4,149 unit tests,
807 browser tests, and 260 hydration tests. Native macOS and Windows behaviour
was not tested.

There are eight findings: one High, two Medium, and five Low. The user decides
what to address next.

Background for readers new to the feature: each catalogue entry (a screen,
page, Markdown document, user flow, or component) now has one path, derived
from its file location, such as `account/billing/invoice`. The path is its
identity, its URL (`/view/<path>/`), and its output folder. A component has
variants: named sets of props, with the paths `<component path>/<slug>`.
**Changes** compares the catalogue with the one built from the Git base
branch. A moved entry is paired with its earlier version and shown as
"Moved".

## Findings

1. **High — Moving a component's last variant into another component breaks
   every catalogue page.**
   - **Where:** the public catalogue reader,
     [`packages/viewer/src/catalogue/references.ts`](../../packages/viewer/src/catalogue/references.ts),
     around line 153.
   - **What happens:** take component `old` with one variant, `primary`, and
     component `new` with one variant, `default`. Delete `old` and add
     `primary` to `new` (with `movedFrom: "old/primary"`). The variant pairs
     correctly. The old parent `old` stays a removed record with no
     variants left, because its only variant moved. The reader requires
     every component record to have a variant, and it throws
     `component needs variants`.
   - **Confirmed:** in a scratch Git repository, `mokly export --base main`
     failed with `[mokly/export-invalid] Could not export catalogue:
[mokly/components] $catalogue: component needs variants`. With
     `mokly serve --base main`, `/`, `/view/new/`, and `/view/new/primary/`
     all returned HTTP 500.
   - **Impact of no change:** an ordinary refactor makes Serve unusable and
     makes every export with Changes fail until the branch point moves past
     the change.
   - **Options:**
     - **A)** Allow a removed component parent to have no variants, and keep
       the rule for current parents.
     - **B)** Omit a removed parent that has no variants left, which loses
       its removal row.
   - **Recommended: A,** and run the existing move fixtures through the
     reader, Serve, and export, not only through the review result. The
     review result accepted this state while the reader did not. Shared
     cross-boundary fixtures would catch this class of disagreement.

2. **Medium — Valid entry paths named like private build directories cannot
   be exported.**
   - **Where:** export's public-name policy,
     [`src/export/resource_policy.ts`](../../src/export/resource_policy.ts)
     (around line 40), and
     [`src/export/public_files.ts`](../../src/export/public_files.ts)
     (around line 46).
   - **What happens:** the path grammar allows segments such as `coverage`,
     `dist`, `node_modules`, and `README`. Export treats them as private
     directories and drops generated files under them.
   - **Confirmed:** a screen at `specs/coverage.mockup.tsx` builds and checks.
     `mokly export --base main` then fails with `Comparison contains a private
export resource: snapshots/before/coverage/index.mobile.html (is inside a
private build or dependency directory (coverage))`. The same catalogue
     with the screen named `guide` exports.
   - **Impact of no change:** one entry with such a name stops the whole
     catalogue from exporting or publishing. The error does not name the
     entry module.
   - **Options:**
     - **A)** During export, trust the accepted compilation's exact
       generated-file inventory, including its parent directories, and keep
       the private-directory filter for every other file.
     - **B)** Reserve these names in the path grammar, with a path diagnostic
       that names the file.
   - **Recommended: A,** with tests that carry such paths through Build,
     Check, Serve, and export in both output modes. Relaxing the
     private-directory filter in general would expose real build
     directories.

3. **Medium — Earlier ownership formats still allow automatic replacement and
   deletion.**
   - **Where:**
     [`src/build/ownership.ts`](../../src/build/ownership.ts) (around line 44)
     accepts the plain `Generated by mokly from …` and
     `Generated by mokabook from …` headers.
     [`scripts/preview/artifact.mjs`](../../scripts/preview/artifact.mjs)
     (around line 33) lets earlier preview markers own pre-derived `view/`
     paths.
   - **What happens:** generated-file headers decide which files Build may
     replace or delete. A file with an old header is treated as Mokly output,
     and Build deletes it as an orphan.
   - **Context:** both readers already exist on `origin/main`; this plan did
     not add them. During Milestone 3 the orchestrator decided to keep them,
     because plan decision 14 lists the formats this plan replaces, and the
     ownership header is a separate contract. The reviewer reads decision 14
     ("no compatibility layer") as also covering these readers.
   - **Impact of no change:** output from much older versions still enters
     automatic replacement and deletion, against the stated clean-break
     policy. The practical risk is low, because these headers are rare in
     current repositories.
   - **Options:**
     - **A)** Remove both migration paths, with rejection tests across the
       ownership consumers and preview adoption.
     - **B)** Keep them, and state in decision 14 and the ownership contract
       that they are deliberate exceptions.
   - **Recommended: A,** in a small follow-up change. One ownership rule with
     no hidden fallbacks is easier to reason about for a delete path.

4. **Low — Folder counts under Changes and search include rows that the
   filter hides.**
   - **Where:**
     [`packages/viewer/src/shell/nav_rows.tsx`](../../packages/viewer/src/shell/nav_rows.tsx)
     (around line 28). Under Changes, the count uses every child. Under
     search, it uses the unfiltered rows. The mockups count only the rows
     they show
     ([`catalogue-navigation-sections.ts`](../../examples/basic/specs/design/library/chrome/catalogue-navigation-sections.ts),
     lines 62–65).
   - **Confirmed:** the reviewer moved `specs/example/screens` and served with
     `--base HEAD`. Under Changes the shell showed "Example 5" above one
     visible row. The orchestrator confirmed the branch in the code.
   - **Impact of no change:** the number next to a folder does not match the
     rows below it, and every Changes and search mockup disagrees with the
     shell.
   - **Options:**
     - **A)** Count the children that the active filter shows, using the
       same visibility function as the rows.
     - **B)** Keep full counts, and change the mockups.
     - **C)** Hide counts while a filter is active, and update the mockups.
   - **Recommended: A,** with the rule stated in `mokly-shell-design.md` and
     tests for All, Changes, and search counts.

5. **Low — The home summary does not count Markdown documents.**
   - **Where:**
     [`packages/viewer/src/shell/views.tsx`](../../packages/viewer/src/shell/views.tsx)
     (`HomeView`, around lines 110–133). It counts screens, components, user
     flows, and pages only. A catalogue of only documents reads "0 screens ·
     0 user flows · 0 catalogue pages".
   - **Impact of no change:** home under-reports the catalogue.
   - **Options:**
     - **A)** Add "N documents" and skip kinds with a zero count.
     - **B)** Remove the summary line, which the mockup does not show.
     - **C)** Show one total.
   - **Recommended: A,** built from a complete, type-checked map of entry
     kinds, so a new kind cannot be left out again.

6. **Low — The "Light only" band on a current document has no mockup and no
   browser test.**
   - **Where:** under Dark, a current document without a dark render shows a
     "Light only" band
     ([`scheme_fallback.tsx`](../../packages/viewer/src/shell/scheme_fallback.tsx)).
     [`mokly-documents.md`](../protocol/mokly-documents.md) says the
     `light-only-document` design shows it. The
     [inventory](../protocol/mokly-shell-design-inventory.md) lists that
     design for a removed document only. Browser tests check only that the
     band is absent.
   - **Impact of no change:** a shipped state has no approved design, against
     the mockup-first rule, and a broken style would not fail any test.
   - **Options:**
     - **A)** Add the mockup state, list it in the inventory, and add a
       browser test that shows the band under Dark.
     - **B)** Reuse an existing depicted pattern.
     - **C)** Correct the contract text only.
   - **Recommended: A.**

7. **Low — Three documents leave folder titles out of the search rule.**
   - **Where:** [`mokly-shell-design.md`](../protocol/mokly-shell-design.md)
     (around line 143), [`mokly-runtime.md`](../protocol/mokly-runtime.md)
     (around line 364), and the
     [shell README](../../packages/viewer/src/shell/README.md) (around line
     158). These say search matches a row's path, title, and tags. The code
     and [`mokly-folders.md`](../protocol/mokly-folders.md#titles) also match
     the titles of the folders above the row.
   - **Impact of no change:** the contracts conflict, and a reader could
     implement or test the wrong rule.
   - **Options:**
     - **A)** Add folder titles to the three statements.
     - **B)** Replace the restated rules with a link to `mokly-folders.md`.
   - **Recommended: B.** The rule drifted because several documents restate
     it.

8. **Low — Three documents still say Markdown rendering is not delivered.**
   - **Where:** [`mokly-rendering.md`](../protocol/mokly-rendering.md) (around
     line 13), [`build-pipeline.md`](../architecture/build-pipeline.md)
     (around line 110), and
     [`package-boundary.md`](../architecture/package-boundary.md) (around
     line 98). These say Markdown files stay private inputs until document
     rendering is implemented. Both Markdown rendering and move detection
     are implemented.
   - **Impact of no change:** readers get conflicting descriptions of what
     happens to Markdown files.
   - **Options:**
     - **A)** Update each status sentence.
     - **B)** Replace duplicated status prose with current behaviour and links
       to the owning contracts, and keep progress only in the plan.
   - **Recommended: B.**

## Residual Test Risk

Native macOS and Windows behaviour was not tested in this review. The new
case-only move and pruning tests now run in native CI (Milestone 6H). Folder
counts under Changes and search, and the current-document "Light only" band,
have no browser tests. Index-entry Changes activation is covered by fixtures,
not by a real Git baseline.
