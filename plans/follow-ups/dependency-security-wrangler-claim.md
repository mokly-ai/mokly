# Align the Wrangler dependency claim with tests

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 191.
- **Location:** `docs/protocol/dependency-security.md:3` and `:188-194`.
- **Reason:** The plan recorded this item after the user's rule of
  2026-10-21 that new review items wait for the user after the merge.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Wrangler:** the Cloudflare command-line tool. Miniflare is its local
    runtime.
- **Background:**
  - `docs/protocol/dependency-security.md:188-194` lists `wrangler` 4.151.0
    as an exact development pin "for preview deployment and the Cloudflare
    local static-host checks".
  - The preview workflow runs `wrangler pages deploy`, at
    `.github/workflows/preview.yml:64` and `:127`.
  - No test or script runs `wrangler` or Miniflare to check a static host.
  - On 2026-10-26 the user kept the page's status line for this item, at
    line 3.
- **Problem:** The protocol names a verification, the Cloudflare local
  static-host checks, that the repository does not run.
- **Impact if no action:** Readers trust a check that does not exist, and
  the page keeps its status line.
- **Root question:** What should the protocol say about why Wrangler is
  pinned?
- **Options:**
  - **A.** Remove the phrase about local static-host checks. Keep preview
    deployment as the reason, and remove the status line. Effort: Small.
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
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user ruled that new review items wait for the user after the merge.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6495).
