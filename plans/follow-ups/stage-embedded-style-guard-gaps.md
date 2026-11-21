# Stage guard misses some embedded style URLs

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-21, from the checks of review findings 3 and 5 of the branch `ci-fix/site-lighthouse-run-lighthouse-budget` (PR #431).
- **Location:** `apps/site/scripts/stage/fragments.ts`, `assertNoEmbeddedUrls`. `apps/site/scripts/stage/stylesheets.ts`, the stage's CSS reference reader.
- **Reason:** `assertNoEmbeddedUrls` is the same as on `origin/main`, and the best fix lets an existing build error reach more inputs, which needs the user.

- **Terms:**
  - **Home stage:** the sandboxed frame on the home page of the public site, `apps/site`, that shows one screen of the dogfood catalogue. `apps/site/scripts/stage.mjs` publishes its documents under `public/stage/`.
  - **Embedded style:** a `style` element or a `style` attribute of a source document of the stage, as Mokly renders it.
- **Background:** The stage moves the source documents into one flat directory. It cannot rebase the URLs of embedded styles, so `assertNoEmbeddedUrls` fails the build when an embedded style names a local file with `url()`. The linked stylesheets get the stage's CSS reference reader, which also finds quoted `image-set()` candidates and top-level `@import` rules.
- **Problem:** `assertNoEmbeddedUrls` finds only `url()` with its own pattern. A quoted `image-set()` candidate or a quoted `@import` in an embedded style passes the guard unchanged, with no copy and no error. After the move, its relative URL resolves from the stage directory and breaks. `site:links` then fails on the missing file of a candidate. A probe of 2026-11-21 showed the quoted `@import` case.
- **Impact if no action:** Such an embedded style breaks on the stage with a late or unclear failure, where the `url()` form gets a clear build error.
- **Root question:** How does the stage find every local URL of an embedded style before it moves the document?
- **Options:**
  - **A.** Use the stage's CSS reference reader in `assertNoEmbeddedUrls`, so that every local reference of an embedded style gets the existing error. It changes no rule, but more inputs reach the existing error. Effort: Small.
  - **B.** Rebase embedded style URLs like linked ones, and drop the error. It changes the failure into support for embedded URLs. Effort: Medium.
- **Left out:** No change. It keeps two readers that disagree on which text is a URL.
- **Wider fix:** A. One reader then serves linked and embedded styles.
- **Previous examples:** PR #431 replaced the pattern of the linked-sheet reader with a tokenizer, after its review found that the pattern missed `image-set()` strings.
- **Recommendation:** A. It reuses the reader that the linked sheets already use.
- **Action:** ask the user, because A makes the existing build error reach more inputs, which is stricter validation.
