# Production Postmark domain verification is unconfirmed

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the second and third unchecked post-merge tasks of the deleted `plans/html-emails.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** The Postmark sending domain, `infra/helm/mokly-cloud/templates/_runtime.tpl:77-81` and `docs/protocol/email.md:110-125`.
- **Reason:** Both checks need the production Postmark account and the deployed production site, which exist only after the merge.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify the Postmark domain. Both public logo URLs answered GET with HTTP 200, but nobody read the Postmark verification state or the deployed site origin.

- **Terms:**
  - **DKIM and return-path records:** The DNS records that let receiving mail servers verify that Postmark sends for the Mokly domain.
  - **Site origin:** The public origin of the static site, which the API uses to build image addresses in the emails.
- **Background:** The HTML emails load the Mokly logo from `<site-origin>/brand/mokly-logo-light.png` and `-dark.png`. The site ships both files under `ts/site/public/brand/`. Mail without verified DKIM and return-path records is more likely to land in spam. The list below gives the evidence so far.
  - Stable chart values set `MKC_SITE_ORIGIN` to `https://` and the configured domain, in `infra/helm/mokly-cloud/templates/_runtime.tpl:77-81`.
  - `docs/ops/production.md:40-44` records a Postmark proof that authenticated without sending mail. It does not record DKIM or return-path verification.
  - On 2026-10-31 GET requests with the user agent `mkc-smoke` to `https://mokly.ai/brand/mokly-logo-light.png` and `-dark.png` returned HTTP 200 `image/png`, with 17,985 and 19,431 bytes.
  - HEAD requests with Python's default user agent returned HTTP 403 on the same day. The GET results prove public serving only, not the site origin of the deployed mailer.
- **Task:** Run the two checks below for production, and record the results in a `docs/ops` email section.
  - Confirm in Postmark that the sending domain's DKIM and return-path records are verified.
  - Confirm that the deployed production API uses `https://mokly.ai` as its site origin, or that a delivered email shows the two expected logo addresses.
- **Impact if no action:** Production sign-in mail can go to spam, or arrive without its logo.
- **Needs:** Access to the production Postmark account, and the production API configuration of its site origin.
- **Done when:** A `docs/ops` email section records both checks with their dates.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/html-emails.md?plain=1#L523-L535) of the deleted plan.
