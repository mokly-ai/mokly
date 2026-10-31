# React fails in Playwright workers on Node 22

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-30, from the branch `calummoore/mokly-ui-controls`, during the second review fix round of the shell views plan.
- **Location:** `tests/browser/shell_styles_page.ts`, which renders package components in the page to avoid the failure, and its rule in `tests/browser/README.md`; `.github/workflows/blacksmith-testbox.yml:39`, which runs the remote gate on Node 22.15.0.
- **Reason:** The cause lies in how Playwright's loader and Node 22 load React, outside the product, and the browser specs avoid it.

- **Terms:**
  - **Playwright worker:** the Node process that runs the browser specs.
    Playwright loads each spec file and its imports through its own module
    loader, and a worker runs several spec files one after the other.
  - **JSX runtime:** `react/jsx-runtime`, which every compiled `@mokly/ui`
    component calls to create its elements.
- **Background:**
  - `package.json` supports Node `>=22.15.0 <23.0.0` and Node 24, and the
    remote gate runs every suite on Node 22.15.0. Local runs on Node 24 do
    not show the failure.
  - Under Node 22.15.0, the JSX runtime throws "TypeError: Cannot read
    properties of undefined (reading 'recentlyCreatedOwnerStacks')" when a
    package component creates an element inside a Playwright worker, once
    the worker has loaded `@mokly/viewer`. The runtime then reads
    `React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`
    from a `react` module that lacks it.
  - On 2026-10-30 it struck twice:
    - `@mokly/ui/metadata-row` created its glyph elements while its module
      loaded. Playwright's test discovery, which loads every spec, failed in
      every browser shard and in the static delivery suite. The glyphs are
      now created when a chip renders.
    - Two new specs rendered `TagChip` and `TagPicker` with
      `renderToStaticMarkup` in the worker. `tag_picker_button.spec.ts` failed
      in browser shard 1. The specs now bundle a small browser entry with
      esbuild and render it in the page, as the viewer fixture does.
  - Reproduction, with the earlier in-worker rendering:
    `npx -y -p node@22.15.0 node node_modules/@playwright/test/cli.js test tests/browser/component_fragments.spec.ts tests/browser/tag_chip_selection.spec.ts --workers=1`.
    Each spec passes alone.
- **Problem:** Any test code that renders React inside a Playwright worker
  can fail on Node 22 alone, depending on which spec ran first in the worker.
- **Impact if no action:** A future spec or a package module that creates
  elements while it loads passes locally on Node 24 and fails only in the
  remote gate, as on 2026-10-30.
- **Root question:** Why does a Playwright worker on Node 22 give the JSX
  runtime a `react` module without its client internals?
- **Options:**
  - **A.** Keep the rule of `tests/browser/README.md` that no React renders
    in a Playwright worker. Effort: Small.
  - **B.** Find the cause, for example two module records of `react` from
    Playwright's loader and Node 22's CommonJS translation, and fix it in the
    test setup, or report it upstream. Effort: Medium.
- **Left out:** Running the gate on Node 24 only, because the package
  supports Node 22.15.0 and the gate checks that lower bound.
- **Wider fix:** B.
- **Previous examples:** The two failures of 2026-10-30.
- **Recommendation:** B. A known cause lets specs render package markup
  directly again, and it shows whether users who import the package under
  similar loaders can meet it.
- **Action:** fix after merge, apply B, because the specs avoid the failure
  and its cause lies outside this branch.
