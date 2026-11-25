# PR jobs hold the account-wide Pages token

- **Severity:** High. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the options check of `plans/app-on-cloudflare.md` on branch `calummoore/gcp-project-cost-v2-3foo`.
- **Location:** `.github/workflows/site.yml` (the `deploy-pr` job), `.github/workflows/preview.yml` (the `deploy-pr` job), `docs/ops/secrets.md`.
- **Reason:** The problem is in the site and Mokly preview workflows, which the app hosting plan does not change.

- **Source:** Review.
- **Category:** Security.
- **Terms:**
  - **Pages token:** the Cloudflare API token in `CLOUDFLARE_PAGES_API_TOKEN` or `CLOUDFLARE_API_TOKEN` that `wrangler pages deploy` uses.
  - **`mokly-site`:** the Pages project of the marketing site. Its production branch serves the site paths of the production apex through the origin router Worker.
- **Background:**
  - The `deploy-pr` jobs of `site.yml` and `preview.yml` deploy a pull request's build to a Pages branch alias, such as `pr-N.mokly-site.pages.dev`.
  - These jobs run the pull request's own installed `wrangler` with the Pages token.
  - Cloudflare documents no project scope for Pages tokens. An Account-level `Cloudflare Pages: Edit` token can deploy any branch of any Pages project in the account.
  - `docs/ops/secrets.md` describes the token as a `mokly-site` token.
- **Problem:** Code in a same-repository pull request runs with a token that can deploy the production branch of `mokly-site`, which serves the production apex site paths.
- **Impact if no action:** A malicious or mistaken change in a same-repository pull request can replace the production marketing site before review.
- **Root question:** How do PR site previews deploy without any credential that can change a production Pages branch?
- **Options:**
  - **A.** Run the PR deploy in a separate job that checks out only the built artifact and runs a pinned `wrangler` from the base branch, so PR code never sees the token. The token still has account scope. Effort: Small.
  - **B.** Use a second Cloudflare account, or a second Pages project in an account that holds no production project, for PR previews only, with its own token. Effort: Medium.
  - **C.** Build PR previews in the PR job and deploy them from a `workflow_run` job on `main` with the token, after a check that the target branch is `pr-N`. Effort: Medium.
- **Left out:** A token with less than account scope does not exist for Pages, as far as the Cloudflare docs show.
- **Wider fix:** C. No PR job then holds a deploy credential.
- **Previous examples:** None found.
- **Recommendation:** A now as a quick step, then C. A removes the direct exposure to PR code at low cost.
- **Action:** ask the user, because the options trade a quick partial guard against a second account or a new workflow, and the token is an operator credential.
