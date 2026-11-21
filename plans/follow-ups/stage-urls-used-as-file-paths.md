# Home stage uses URL text as file paths

- **Severity:** High. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the review of the branch `ci-fix/site-lighthouse-run-lighthouse-budget` (PR #431), finding 1.
- **Location:** `apps/site/scripts/stage/stylesheets.ts`, `resolve` and `safeTarget`. `apps/site/scripts/stage/fragments.ts`, where `collect` resolves each document reference and reads each linked stylesheet. `apps/site/scripts/stage.mjs`, the stylesheet reader and the `copyFile` loop.
- **Reason:** `origin/main` had the same path handling before the branch moved it unchanged, so the fix belongs to a separate branch.

- **Terms:**
  - **Home stage:** the sandboxed frame on the home page of the public site, `apps/site`, that shows one screen of the dogfood catalogue. `apps/site/scripts/stage.mjs` publishes its documents under `public/stage/`.
  - **Catalogue output:** the generated documents, stylesheets, and assets under `mokly-static/` that the stage reads.
- **Background:** The stage reads four screen documents from the catalogue output. It inlines each linked stylesheet, rebases the `url()` and `@import` references of the inlined text, and copies each other local resource beside the documents. `resolve` turns a reference into a catalogue-root path. It removes a `#fragment`, but it keeps a `?query` and keeps percent escapes. Mokly encodes each path segment of a configured stylesheet link, and it keeps query strings and fragments on CSS asset URLs, as `docs/protocol/mokly-rendering.md` and `docs/protocol/mokly-imported-styles-assets.md` say.
- **Problem:** The stage uses the URL text as a disk path. A probe on 2026-11-20 ran the stage code of `origin/main` and of the branch on the same inputs. Both failed with the same `ENOENT` at the same paths. `url("../art/icon.svg?rev=1#mark")` queued `static/art/icon.svg?rev=1` for the copy. A link with an encoded segment passed `static/styles/node_modules/%40scope/pkg/a.css` to the reader, but the folder on disk is `@scope`. The four current stage documents use neither form, so the site builds today.
- **Impact if no action:** The site build fails with `ENOENT` as soon as a staged screen links a stylesheet under an encoded path segment, or a stage stylesheet adds a query to an asset URL, although the file exists.
- **Root question:** How does the stage find each catalogue file and still emit the URL that the browser needs?
- **Options:**
  - **A.** Split off the query and the fragment before the lookup. Decode each path segment, check the confinement after the decoding, and restore the suffix when the stage writes the URL. Effort: Small.
  - **B.** Give the stage one resolver that returns both the confined disk path and the encoded output URL of a reference. Use the disk path for each read and copy, and the output URL in the markup and the inlined CSS. Effort: Small.
  - **C.** Have Mokly publish a URL-to-file map with the catalogue output. It changes the generated artifact contract. Effort: Large.
- **Left out:** Removing the query from the published URL. It changes what the browser requests.
- **Wider fix:** B. Each stage caller then gets separate values for disk access and for the browser, so a new caller cannot mix them.
- **Previous examples:** Mokly's CSS compiler separates the file path from its suffix before the lookup, in `crates/mokly-css/src/compiler_assets.rs`.
- **Recommendation:** B. It protects the stylesheet reads and the asset copies at one boundary.
- **Action:** fix after merge, apply B, because the problem is older than the branch that found it, and no current stage input meets it.
