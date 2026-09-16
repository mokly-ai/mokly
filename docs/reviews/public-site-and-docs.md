# Public Site And Docs Review

Read-only review of the complete branch diff against `origin/main` after the
Milestone 8 push (`85a02ff`), using the
[implementation review prompt](../implementation-review-prompt.md). The
branch adds the `site/` Astro workspace, the site protocol documents, the
Folio site mockups in the example design catalogue, two GitHub workflows and
their tests, and changes no line of `src/`. Findings are recorded for the
user's decision. The approved follow-up below records later implementation.

## Findings

1. **High — the CI upload page contradicts the upload protocol.**
   `site/src/content/docs/ci/the-upload.mdx` reads as shipped fact beside the
   published contract at `/docs/reference/upload/` and disagrees with it four
   times: it shows a `POST /uploads` request line although the CLI posts to
   the exact endpoint (`docs/protocol/mokly-upload.md`, `src/publish/http.ts`);
   it says the base fields are absent without comparisons although the
   manifest writes nulls and receivers must reject missing fields; it says
   receivers reject anything that is not a regular file although optional
   directories are accepted; and it places authorization after decompression
   although the protocol authenticates first. Doing nothing lets a third
   party build a non-conforming, less safe receiver from the public site.
   Options: **A)** correct the four statements; **B)** A plus a test that
   cross-checks the normative claims on `ci/*.mdx` against
   `docs/protocol/mokly-upload.md`; **C)** demote the page to a pointer at the
   Reference document. **Recommended: B.** The repository already
   machine-verifies CLI options; this is the page where drift becomes
   someone else's security bug.

2. **High — the documented `--engine-strict` guard does not exist and the
   new Lighthouse dependency would fail it.** `docs/protocol/dependency-security.md`
   justifies the `unifont` → `undici@7.29.1` override by stating that
   minimum-Node installation uses `npm ci --engine-strict`; no workflow,
   script or `.npmrc` sets it, and `lighthouse@13.4.1` declares
   `engines.node >= 22.19` against the repository's 22.14 floor. Doing nothing
   leaves the security contract asserting a check that never runs. Options:
   **A)** correct the document to what CI does and record the Lighthouse
   exception; **B)** add `--engine-strict` to the minimum-runtime install and
   move `lighthouse` and `chrome-launcher` so they install only in the
   Lighthouse job; **C)** add a test asserting every package's `engines.node`
   satisfies the declared minimum. **Recommended: B plus C.**

3. **Medium-high — the required Lighthouse gate blocks every pull request
   on a single performance run.** `ci.yml` adds `site-lighthouse` to
   `Required CI` with performance ≥ 0.95 measured once per route on a shared
   runner. Doing nothing lets runner variance block unrelated pull requests.
   Options: **A)** keep as is; **B)** keep it required but take the median of
   three runs, or lower performance to 0.90 while keeping accessibility at
   1.0; **C)** make it report-only and move accessibility into deterministic
   browser assertions. **Recommended: B with the deterministic assertions
   from C.**

4. **Medium — a broad dependency-resolution change rides along and the
   boundary fixture does not cover it.** The lockfile adds about 410
   packages and moves roughly forty hoisted versions, including the published
   package's production closure (`brace-expansion`, `readdirp`, `picomatch`,
   `entities`), while `tests/fixtures/site-package-boundary.json` pins
   declared ranges only. Options: **A)** split lockfile refreshes from
   feature work; **B)** extend the fixture to pin the resolved production
   closure; **C)** both. **Recommended: C.**

5. **Medium — a merge publishes a crawlable production site of unshipped
   features and placeholder legal pages.** `robots.txt` allows everything,
   the sitemap lists `/terms/`, `/privacy/` and every `status: ahead` page,
   previews advertise themselves as indexable, and the alignment pass and
   legal text are post-merge work. Options: **A)** rely on the custom domain
   not being attached; **B)** emit `X-Robots-Tag: noindex` through
   `site/public/_headers` whenever `SITE_ORIGIN` is not the production
   origin and drop the legal placeholders from the sitemap; **C)** gate
   `deploy-main` behind a repository variable until the alignment pass.
   **Recommended: B plus C.**

6. **Medium — six verified factual errors in the authoring, catalogue and
   CLI pages.** The Details page lists id, title and route rows the inspector
   does not render; the tags page omits components; the components page says
   every variant renders every scheme although components may narrow
   `colorSchemes`; the screens table omits `address`; the exit-status page
   quotes a config-missing message the CLI never emits; and four pages
   enumerate build output without component-variant documents. Options:
   **A)** fix the statements; **B)** A plus extend
   `site/tests/docs_authoring.test.ts` to cover `ScreenInput`, `PageInput`
   and `ComponentInput` fields as it already covers `MoklyConfig`; **C)** B
   plus a test that every quoted error string exists in `src/`.
   **Recommended: B, with C as a cheap addition.**

7. **Medium — two catalogue-wide design invariants were narrowed to exclude
   the site screens with no replacement.** `tests/design_links.test.ts` and
   `tests/design_library_usage.test.ts` skip `design-site-*`, and no test
   resolves the site screens' link ids to artifacts. Options: **A)** leave;
   **B)** add a site-shaped variant of the link-resolution loop as a shared
   helper parameterised by the allowed control set; **C)** relax the original
   assertions. **Recommended: B.**

8. **Medium — the Folio tokens and layout exist in two hand-maintained
   copies with no guard.** `examples/basic/generated/site-tokens.css` and
   `site.css` duplicate `site/src/styles/`, the mockups are declared the
   source of truth, and nothing compares them. Options: **A)** leave;
   **B)** a test asserting every mockup `--site-*` value equals the site
   token; **C)** generate one from the other. **Recommended: B now.** The
   example README's stylesheet list is also stale.

9. **Medium-low — accessibility and copy gaps against the site's own
   protocol.** Mobile header search is painted second but tabbed first;
   the brand link never carries `aria-current`; one docs page says "not
   supported"; three declared tokens are unused and contradict the spec
   (hero size, sidebar width, `accentActive` with no pressed state); six
   controls use the decorative hairline as their only boundary; the smallest
   type roles set navigation text the spec reserves them from; and the
   protocol's focus, contrast, zoom, reduced-motion and copy rules have no
   automated test. Options: **A)** fix the named items; **B)** A plus
   mechanical stylesheet, contrast, copy and 320px browser tests.
   **Recommended: B.**

10. **Low — close-job and cleanup edge cases.** `site.yml`'s close job
    checks out the pull request head, which may be unreachable after the
    branch is deleted, so cleanup can be skipped while the comment is marked
    inactive; `scripts/site/cleanup.sh` aborts under `set -e` on a
    non-numeric page count instead of reporting a retained status, and can
    leave partial ids on a mid-stream `jq` failure. A direct fix is enough.

11. **Low — plan hygiene.** Three completed milestones left their final
    check-run item unticked; ticked in this branch's closing commit.

12. **Low — the stage rewriter drops URL fragments silently.**
    `site/scripts/stage/fragments.ts` discards `#fragment` when rewriting
    references. Harmless inside the sandboxed frame; document or preserve.

## Areas With No Findings

The published package boundary (`files` unchanged, tarball test, license
resolution of the workspace link), workflow credential handling and pins,
the xtask ordering, the build-time repository readers (all fail loudly),
the cloud and CI documentation sourcing beyond finding 1, and the mockup
structural rules.

## Flakes Observed During Delivery

Two intermittent failures appeared in full-gate runs and passed on rerun and
in isolation: `tests/browser/review_failure_reload.spec.ts` and a Node 24
`cjs_lexer` fatal crash that kills one unit test file under
`--test-concurrency=2`. The branch changes no product source, test
concurrency or module loading; the reviewer's independent full browser run
passed 276/276. The larger example catalogue makes the shared browser server
slower and the larger install changes the memory profile, which can make
either marginally likelier without causing it. If the crash recurs, lower
the test concurrency or raise the heap for `npm test` rather than changing
product code.

## Approved Follow-up

The user approved findings 1 (B), 2 (B plus C), 3 (C) and 10 for the first
change, then 8 (B) and 9 (B) for the change recorded below it. The remaining
findings retain the user's recorded decisions.

- **Finding 1:** the upload page shows headers without an invented request
  path, requires null comparison fields and rejection of missing/extra fields,
  accepts regular files and optional directories, and puts credential
  authentication before decompression. `site/tests/docs_ci.test.ts` checks the
  CI pages against the protocol, transport, manifest validator and CLI sources,
  including headers, response categories, no retries, timeout and credentials.
- **Finding 2:** minimum-runtime installs with `npm ci --engine-strict`.
  Lighthouse and its launcher moved to the separately locked
  `site/lighthouse/` package outside the root workspaces. The Node 24 audit job
  alone installs, audits and typechecks those tools. The root command retains
  explicit installation guidance when they are absent. React Native's existing
  Node-compatible launcher remains a dependency of its own development tools.
  Root dependencies and the published package allowlist are unchanged.
- **Finding 3:** Lighthouse retains its failing job status and report artifact,
  but `Required CI` no longer depends on it. Shared browser assertions cover
  every route at 390px and 1440px in light and dark: one heading and main,
  language, image alternatives, accessible names, computed focus outlines on
  the first five keyboard targets and no horizontal overflow. Existing
  structure checks were consolidated into that shared coverage.
  The new route walk found a long inline path overflowing the static-export
  reference at 390px; it now uses the existing scrollable code-block format,
  without changing tokens or layout styles assigned to the later follow-up.
- **Finding 10:** close uses the default checkout ref. Cleanup defaults
  missing/null page counts to zero, reports malformed counts as retained, and
  buffers a page's matching ids until parsing succeeds. Regressions exercise
  malformed counts, fallback pagination and partial output after an earlier
  successful page, proving that no deletion occurs on listing failure.

Regressions reproduced the original documentation, CI and cleanup failures
before their fixes. The dependency and delivery protocols, README guidance,
workflow tests and Milestone 10 checklist accompany the implementation.

The strict lockfile scan exposed one additional incompatibility:
`@img/sharp-win32-ia32@0.35.4` declares `engines.node: ^20.9.0`. It is an
optional Windows/ia32 artifact that no supported installation selects, so the
engine test skips optional platform artifacts outside the installed platform
set and the dependency-security contract records that rule. The other 522
locked Node engine ranges accept 22.14.0. Isolating Lighthouse removed 79
entries without changing any retained package version.

Verification on Node 24.14.1 and npm 11.7.0:

| Command                                                                                                               | Observed result                                                                                   |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm ci --engine-strict`                                                                                              | Pass, including a clean install from the final root lockfile                                      |
| `npm ci --prefix site/lighthouse --engine-strict`                                                                     | Pass                                                                                              |
| `npm run build --prefix site/lighthouse`                                                                              | Pass after enabling TypeScript source imports in this separately checked runner                   |
| `npm audit --prefix site/lighthouse --audit-level=low --include=prod --include=dev --include=optional --include=peer` | Pass, no vulnerabilities                                                                          |
| `npm run lint`                                                                                                        | Pass                                                                                              |
| `npm run format`, then `npm run format:check`                                                                         | Pass                                                                                              |
| `npm run typecheck`                                                                                                   | Pass                                                                                              |
| Focused docs, Lighthouse installation, workflow, cleanup and release tests                                            | 31 passed; the strengthened CI and cleanup checks also passed separately                          |
| `npm test`                                                                                                            | 1,653 passed, one failed: the Sharp engine range above; none skipped/cancelled                    |
| `npm run site:check`                                                                                                  | Pass: build, types, 129 site unit tests, links and all 336 browser tests                          |
| `npm run site:lighthouse`                                                                                             | Pass: all 12 route/viewport rows meet every threshold                                             |
| `bash -n scripts/site/cleanup.sh`                                                                                     | Pass                                                                                              |
| `cargo clippy --all-targets --all-features -- -D warnings`                                                            | Pass                                                                                              |
| `cargo fmt --all -- --check`                                                                                          | Pass                                                                                              |
| `cargo test --workspace`                                                                                              | Pass: all four tests                                                                              |
| `cargo xtask rust-file-length-lint --all`                                                                             | Pass: all eight Rust files                                                                        |
| `npm run example:check`, `npm run package:check`                                                                      | Pass                                                                                              |
| `npm run package:smoke`                                                                                               | Pass: packed consumers, including real local upload/server smoke checks                           |
| `npm run test:browser`                                                                                                | Pass: all 276 catalogue browser tests, including `review_failure_reload`                          |
| `cargo xtask check` (1,800-second timeout, then one retry)                                                            | First run: Sharp assertion and known Node crash; retry: 1,653 passed, only Sharp assertion failed |
| `git diff --check`                                                                                                    | Pass                                                                                              |

The first site browser run exposed the reference-page overflow described above.
A subsequent build overlapped a clean install and failed because `astro` was
temporarily absent; verification was rerun sequentially. Another complete site
run reported all 336 tests passing but exited with signal 143;
the confirmation run passed with exit 0. The isolated runner's first build
reported TS5097; its own tsconfig now permits the existing `.ts` imports and
the build passes.

The first complete gate hit the known Node 24 `cjs_lexer` fatal error in
`tests/watch_resource_boundaries.test.ts`. The required retry completed that
file successfully and reproduced only the Sharp assertion, which the platform
rule above resolved; the closing gate on the committed tree is recorded in
the plan.

Both changed documentation pages were served and captured at 390px/1440px in
light/dark under `.context/site-followups/`: `docs-ci-the-upload-*.png` and
`docs-reference-export-delivery-*.png`. The upload mobile/light and
desktop/dark captures and the reference mobile/light capture were inspected.

## Approved Follow-up: Findings 8 And 9

The user approved 8 (B) and 9 (B). Both were implemented in one change.

- **Finding 8:** the Folio tokens have one source, `design/folio/tokens.css`.
  `site/src/styles/tokens.css` is an `@import` of it that the Astro build
  inlines, and `npm run build` copies the same file to
  `examples/basic/generated/site-tokens.css`, which the generated mockups link
  by relative path. The copy stays tracked, as the example's derived-mode check
  requires, and `tests/design_site_tokens.test.ts` compares it with its source
  byte for byte. Every `--site-*` name and value was carried over unchanged by
  the extraction; the deliberate value changes belong to finding 9 below and
  now reach both sides at once. The source carries both responsive mechanisms:
  the 768px breakpoint the site resolves, and the `data-site-viewport`
  compositions a mockup fragment pins, which a test proves declare the same
  roles. The mockup sheet no longer defines tokens of its own.
  `tests/design_site_parity.test.ts` compares the two layout sheets rule by
  rule at the wide and narrow compositions, expanding `padding` and `margin`
  shorthands and ignoring a box the composition removes: 207 shared rules at
  the wide composition and 209 at the narrow one. Fourteen selectors differ
  structurally and are listed with their reason, and a third test fails when
  one of those is resolved or disappears, so the list cannot go stale.
- **Finding 8, drift found and fixed:** the mockups kept a 38px search control,
  a 0.6-opacity trail separator, a code head without the minimum target size, a
  literal 1120px changelog measure and literal 272px/256px/240px documentation
  columns, and they lacked the site's skip-link box, version-link color and
  copy-control width; the site lacked the mockups' trail flex row and chevron
  transition. The documentation columns now resolve from `sidebarWidth` and
  `onpageWidth` on both sides.
- **Finding 9:** the documentation search keeps its place in the reading order.
  It still follows the brand in the document, and below the breakpoint it now
  shares the first row with the brand while the navigation takes the row
  beneath, so nothing is painted before the control that precedes it. The brand
  carries `aria-current="page"` on the home in the header and the footer. The
  export page states what to serve the catalogue from instead of what is not
  supported, and the upload page's rejection row names an unknown version.
  `--site-hero-display` is gone: the hero uses `hero-size` and `hero-line`, so
  the mobile hero is the documented 44px at 1.05. `--site-sidebar-width` is
  272px, the measure the layout already used. The primary button has a pressed
  state in `accentActive`. The search control, the quiet button, the search
  field, the section disclosure, the version chip and the previous and next
  cards take `folioLineStrong`. The rubrics, the version label and the
  changelog's release rubric moved from the nano and micro roles to `caption`;
  nano and micro now set only the depicted shell miniature.
- **Finding 9, tests:** `site/tests/styles.test.ts` forbids `outline: none`
  and `outline: 0` anywhere and requires the whole boundary of every control
  rule — one naming a documented control, or any rule reserving the minimum
  target size — to use `folioLineStrong`; it also reads the built stylesheet
  back to prove the shared tokens were inlined rather than left as an import.
  `site/tests/contrast.test.ts` measures nineteen documented pairs in both
  schemes with a WCAG luminance function. `site/tests/copy.test.ts` reads the
  built pages: no route outside Reference says "not supported", "coming soon"
  or "roadmap" outside a code sample, and no marketing route uses the internal
  nouns. A 320px light Playwright project runs the route walk and the shared
  accessibility helper, whose `html[lang]` assertion is unchanged.
- **Finding 9, the 320px walk found one overflow:** `/docs/reference/upload/`
  pushed the page 22px wide because a grid item in the document body could not
  shrink below its longest published path. Body children and list items may now
  shrink, and a long path or URL breaks rather than widening the column.

Verification on Node 24.14.1 and npm 11.7.0, all on the committed tree:

| Command                                       | Observed result                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run lint`                                | Pass                                                                                     |
| `npm run format`, then `npm run format:check` | Pass                                                                                     |
| `npm run typecheck`, `npm run site:typecheck` | Pass, including `astro check` over 103 files                                             |
| `npm test`                                    | Pass: 1,661 passed, none failed, skipped or cancelled                                    |
| `npm run site:check`                          | Pass: build, types, 136 site unit tests, 6,447 link references and all 394 browser tests |
| `npm run example:check`                       | Pass: valid and untracked, 298 files                                                     |
| `cargo xtask check`                           | Pass on the first run, exit 0; no retry needed and neither recorded flake appeared       |

Two regressions were reproduced before their fixes: the control-boundary test
failed on the hairline it now forbids, and the 320px walk failed on the
overflow above. Two existing tests needed updating for real behavior rather
than to pass: the isolated example baseline fixture now copies the token source
and its copy step, and the site screens test expects the home's brand to mark
the current page twice.

The home and `/docs/start/install/` were captured at 320px, 390px and 1440px in
both schemes under `.context/site-screens/m10/`, alongside three regenerated
mockups. Both 320px pages in both schemes and the documentation page at 1440px
light were inspected, with the desktop home and documentation mockups, which
confirmed the pinned compositions still resolve from the shared tokens.

## Follow-up Review

A second read-only review of the two follow-up commits (`848ff02`,
`532c673`) confirmed that every approved item is implemented with a
regression behind it and found no broken behavior. Its findings are gaps in
the new guards, recorded here for the user's decision; none has been applied.

1. **Medium — the control-boundary test inspects only `border:` and
   `border-color:`.** Side-specific borders escape it, and two control rules
   still carry the decorative hairline that way: `.site-code-head`
   (`site/src/styles/docs.css`) and `.site-release-index-link`
   (`site/src/styles/changelog.css`). Doing nothing leaves the delivery
   contract's "whole boundary" rule untrue and unenforced. Options: **A)**
   widen the regex to every `border*` property and fix the two rules;
   **B)** A plus classify a control by a documented control selector rather
   than by reserved target size, so containers such as the code head are not
   miscounted; **C)** narrow the contract to full-shorthand borders; **D)**
   parse the CSS with `lightningcss` and check resolved longhands.
   **Recommended: B**, with D if the stylesheet tests keep growing.

2. **Medium — the copy test holds `/changelog/` to the marketing noun
   rules, but its text is release notes generated from commit messages.**
   A future release note containing "manifest", "schema" or "worker" would
   fail `Required CI` on every later pull request. Options: **A)** drop the
   changelog from the marketing set; **B)** keep it but exempt the rendered
   release notes and check only the page's authored chrome, as the Reference
   section is already exempted; **C)** require release notes to avoid the
   nouns. **Recommended: B.** The user chose to remove the internal-noun
   check and keep the phrase check; finding 7 below falls away with it.

3. **Medium-low — the close job now checks out the pull request merge ref
   and still runs the branch's cleanup script with the Pages token.** The
   merge ref is the one GitHub stops maintaining after close, and an
   unmerged branch can run an edited `cleanup.sh` with the credential.
   Options: **A)** leave; **B)** check out `pull_request.base.ref`; **C)**
   check out the repository default branch; **D)** drop the checkout and
   inline the cleanup. **Recommended: B**, and update the workflow test that
   currently asserts no `ref`.

4. **Medium-low — the parity test exempts whole selectors.** Fourteen
   shared rules are excluded from comparison entirely, so new drift on them
   is invisible. Options: **A)** leave; **B)** exempt listed properties per
   selector and prove each still differs; **C)** unify the two sheets.
   **Recommended: B** as the interim guard, C as the goal. The test also
   concatenates the site sheets alphabetically rather than in the layout's
   load order, and expands only `padding` and `margin` shorthands.

5. **Low — the engine test's platform list omits Linux arm64.** The list
   matches CI and the documented sentence, but ARM Linux is a realistic
   developer platform. Options: **A)** leave; **B)** add linux/arm64 and
   win32/arm64 and update `dependency-security.md`; **C)** invert to an
   explicit exception list naming `@img/sharp-win32-ia32`. **Recommended:
   B now, C if a second exception appears**; also add `--engine-strict` to
   the `export-platforms` install.

6. **Low — the Lighthouse runner is no longer typechecked by a required
   gate.** `site/lighthouse/run.mjs` is excluded from the site typecheck and
   its build and audit run only in the report-only job. Options: **A)**
   record this in `site/README.md`; **B)** keep the logic in the typechecked
   `site/src/lighthouse.ts` and reduce the runner to glue; **C)** split the
   job's setup, audit and typecheck into a required job and keep only the
   budget measurement report-only. **Recommended: C.**

7. **Low — the marketing route list in the copy test is hardcoded.** A new
   marketing route silently escapes the rule. Options: **A)** leave;
   **B)** derive the set as every built route outside `/docs/`; **C)** assert
   the literal list equals that derivation. **Recommended: B.**

Areas with no findings: the upload page fix and its cross-check test, the
cleanup script and its regressions, the isolated Lighthouse package and its
documentation, the token-sharing mechanics, the accessibility stylesheet
changes against the design contract, the contrast test, the `Required CI`
change, and the documents.
