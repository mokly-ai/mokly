# Align the Wrangler dependency claim with tests

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 191.
- **Location:** `docs/protocol/dependency-security.md:3` and `:198-203`.
- **Reason:** Option A removes a check that the page's status line marks as
  still to build, and no user decision chose removal over building it.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Wrangler:** the Cloudflare command-line tool. Miniflare is its local
    runtime.
- **Background:**
  - `docs/protocol/dependency-security.md:198-203` lists `wrangler` 4.164.0
    as an exact development pin "for preview deployment, the Cloudflare
    local static-host checks", the cloud site, and the cloud origin router.
  - The preview workflow runs `wrangler pages deploy`, at
    `.github/workflows/preview.yml:74` and `:144`.
  - No test or script runs `wrangler` or Miniflare to check a static host.
  - On 2026-11-17 Mokly Cloud moved into this repository. The root
    `package.json:121` now pins `wrangler` 4.164.0, and
    `apps/site/package.json:53` and `apps/worker/package.json:18` pin the
    same version.
  - The cloud uses Wrangler for more than previews.
    `infra/scripts/deploy-origin-router.sh:16` deploys the origin router
    with `wrangler deploy`. The site deploy runs
    `wrangler pages deploy dist`, as
    `apps/site/tests/site_workflows.test.ts:154` checks. The
    origin router tests run in the local Workers runtime through
    `@cloudflare/vitest-plugin`, in `apps/worker/vitest.config.ts:1-8`. None
    of these checks a static host.
  - On 2026-10-26 the user kept the page's status line for this item, at
    line 3.
- **Problem:** The protocol names a verification, the Cloudflare local
  static-host checks, that the repository does not run.
- **Impact if no action:** Readers trust a check that does not exist, and
  the page keeps its status line.
- **Root question:** What should the protocol say about why Wrangler is
  pinned?
- **Options:**
  - **A.** Remove the phrase about local static-host checks. Name the
    reasons that exist: preview deployment, the deploys of the cloud site
    and origin router, and the origin router tests in the local Workers
    runtime. Correct the version, and remove the status line. Effort:
    Small.
  - **B.** Add a test that serves a built site with `wrangler pages dev`.
    Every gate then starts the local Cloudflare runtime. Effort: Medium.
- **Left out:** Mark the check as optional in the text. It still names a
  check that does not run. Fewer than three approaches exist, because the
  claim either goes or a real check backs it.
- **Wider fix:** None. The `documentation` skill already requires protocol
  claims to match the code.
- **Previous examples:** None found.
- **Recommendation:** A. It makes the protocol match the current
  verification without a slow new gate.
- **Action:** ask the user, because A drops the Cloudflare local static-host
  checks from `docs/protocol/dependency-security.md:198-200`, a requirement that
  the status line keeps open, and B adds a gate.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6495).
