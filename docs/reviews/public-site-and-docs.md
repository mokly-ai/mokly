# Public Site And Docs Review

Read-only review of the complete branch diff against `origin/main` after the
Milestone 8 push (`85a02ff`), using the
[implementation review prompt](../implementation-review-prompt.md). The
branch adds the `site/` Astro workspace, the site protocol documents, the
Folio site mockups in the example design catalogue, two GitHub workflows and
their tests, and changes no line of `src/`. Findings are recorded for the
user's decision; none has been applied.

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
