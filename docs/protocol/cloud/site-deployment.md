# Site Deployment

Status: The deploy jobs still build the mockups before the site, and they read the repository variable `SITE_STAGE_PR` for the home stage label. [Milestone 5](../../../plans/canvas-redesign.md#milestone-5-site-home) removes the mockups build and `SITE_STAGE_PR` with the stage.

This is the deployment sub-contract of [Site delivery](./site-delivery.md).
The maintainer steps that create the Pages project, attach the production
domain and verify the legacy redirects are in the
[deployment runbook](../../ops/deploy.md#public-site).

## Deployment

The site workflow:

- Pushes to `main` deploy the built site to the production branch `main` of
  the direct-upload Cloudflare Pages project `mokly-site`. `SITE_ORIGIN` is
  `https://<MKC_DOMAIN>`. Missing inputs fail before build.
- Opened, synchronized and reopened same-repository pull requests build the
  PR head commit and deploy to `pr-<number>`. `SITE_ORIGIN` becomes
  `https://pr-<number>.mokly-site.pages.dev`. Forks and Release Please PRs
  (head branches starting
  `release-please--` or labels containing `autorelease:`) skip deploy and close.
- Both deploy jobs install the pinned Node, npm and `package-lock.json`, then
  build the site. Deployment uses the npm workspace's installed Wrangler with
  no registry fallback. The deployed `_headers` file emits the wildcard CORS
  response and the other headers that
  [Site delivery](./site-delivery.md#output) defines. Actions use the same
  immutable pins as CI and the catalogue preview workflow.
- Credentials mirror the preview workflow: repository variable
  `CLOUDFLARE_ACCOUNT_ID` and secret `CLOUDFLARE_PAGES_API_TOKEN`, falling
  back to `CLOUDFLARE_API_TOKEN`, enter only the validation, deploy and
  cleanup steps through `env`. Missing credentials fail deployment with an
  error annotation. Forks receive none.
- One bot-authored sticky comment marked `<!-- mokly-site -->` reports the
  latest run status, target alias URL, PR head commit and workflow run, including
  failures. Its only app outcome line has the exact form
  `Open the app for this pull request: https://pr-<number>.preview.<MKC_DOMAIN>/sign-in`.
  The catalogue comment is separate. Closing an eligible PR marks this
  comment inactive even if cleanup fails; no comment is created by the close
  job when none exists.
- Closing an eligible PR deletes only the Pages deployments whose branch is
  that PR's `pr-<number>`, after listing every page of deployments. Missing
  credentials, a transport, HTTP, API or parse failure while listing, and a
  malformed page count all report the deployments as retained and delete
  nothing; a page that does not parse completely contributes no deletions. A
  failed delete is reported as a warning and as retained and does not stop the
  other deletions. The close job runs on the event's default ref, not on a PR
  head that may already be deleted.
- Concurrency group `site-<PR number or ref>` cancels superseded runs, including
  an open-PR deploy when the close event arrives, independently of the catalogue.

The production domain is attached to the Pages project by a maintainer. The
release process is: merge to `main`, the workflow deploys, and the deployed
site shows the changelog from the installed Mokly package. There is no
separate site version.

The legacy `getmokly.com` zone is operator-managed in the Cloudflare
dashboard, outside Terraform. Both `getmokly.com` and `www.getmokly.com`
return a `301` to `https://mokly.ai` with the original path and query string
preserved. The redirect is a Cloudflare zone redirect rule rather than a Pages
`_redirects` entry, because Pages redirect sources cannot select an incoming
hostname.
