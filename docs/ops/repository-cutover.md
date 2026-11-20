# Repository Cutover

This runbook moves the delivery of Mokly Cloud from the private repository
`mokly-ai/mokly-cloud`, the old repository, to this public repository,
`mokly-ai/mokly`. Do the steps before the merge in order. After the merge, the
cutover switch starts cloud delivery here. When production runs from here,
[Repository Retirement](./repository-retirement.md) retires the old
repository. Each step needs owner access to both repositories. Workspace agent
tokens cannot list secrets or variables, so an owner compares them on
**Settings → Secrets and variables → Actions** or with `gh`. GitHub never shows
a secret value again, so set each secret from its source.

## Before The Merge

Merge nothing more to the old `main`: a push there can deploy older code, such
as the site. `gh api repos/mokly-ai/mokly-cloud/commits/main --jq .sha` must
print the newest commit that the pull request ports. On 2026-11-19 that was
`55972c86` (cloud PR #132). Leave `MKC_CLOUD_CUTOVER_ENABLED` unset until
[the switch](#turn-on-cloud-delivery).

### Stop The Old Deployments

The trust step keeps the old repository in the trust until
[it retires](./repository-retirement.md). The old `site` and `desktop-release`
workflows also deploy with secrets outside that trust. So stop the deploy
paths of the old repository first, shortly before the trust step:

1. Close the open pull requests there. The old **Close PR Site** job then
   deletes their `pr-N` deployments of the `mokly-site` Pages project, and the
   old **Preview** workflow removes their cloud previews `preview-pr-N`.
   Their branches stay for the port after the merge. On
   2026-11-19, `gh pr list -R mokly-ai/mokly-cloud` listed #133, #107 and #88,
   each with a site preview. Run
   `gh pr close NUMBER -R mokly-ai/mokly-cloud --comment "Closed for the move to mokly-ai/mokly."`.
   Check: the **Mokly preview** comment of each one says **Preview removed**,
   and the **Cleanup** line of its **Mokly website** comment starts with
   `deleted`. On **Cleanup failed** or `retained`, run
   `gh run rerun RUN -R mokly-ai/mokly-cloud` for the run that the comment
   links. A site rerun fails again when the line names HTTP 400 and
   `per_page`, because the old cleanup asks Cloudflare for 100 deployments a
   page. A pull request with a merge conflict, such as #88 on 2026-11-19, gets
   no site run and no **Cleanup** line. In these two cases, set
   `CLOUDFLARE_API_TOKEN` to a Cloudflare API token with Pages Edit on the
   account. Then run this until it prints nothing:

   ```sh
   api="https://api.cloudflare.com/client/v4/accounts/$(gh variable get CLOUDFLARE_ACCOUNT_ID -R mokly-ai/mokly-cloud)/pages/projects/mokly-site/deployments"
   ids=$(for page in $(seq 500); do
     body=$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$api?page=$page") || break
     jq -r '.result[] | select(.deployment_trigger.metadata.branch == "pr-NUMBER") | .id' <<<"$body"
     jq -e '(.result | length > 0) and .result_info.page < (.result_info.total_pages // infinite)' <<<"$body" >/dev/null || break
   done)
   for id in $ids; do curl -fsS -X DELETE -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$api/$id?force=true"; done
   ```

2. Run `for name in deploy desktop-release preview site; do gh workflow disable "$name.yml" -R mokly-ai/mokly-cloud; done`.
   Check: `gh workflow list -R mokly-ai/mokly-cloud --all` shows **Deploy**,
   **Desktop release**, **Preview** and **Site** as `disabled_manually`.

The old `ci` and `foundation` workflows stay on until the old repository
retires. Old CI deploys nothing. An old Foundation run stops at its plan,
because that plan deletes the new trust bindings, and CI never deletes a
[trust resource](../protocol/cloud/foundation-promotion.md#trust-set). If the
merge does not happen, run the same loop with `enable` in place of `disable`.
Then reopen each pull request with `gh pr reopen NUMBER -R mokly-ai/mokly-cloud`.

### Trust Both Repositories

Google Cloud trusts only the workflows that the federation condition names, so
CI here cannot apply this change. The operator applies it from the head of the
pull request, shortly before the merge. The new condition trusts the `ci`,
`deploy`, `foundation` and `preview` workflows on `main` of both repositories,
so the old repository keeps its access until it retires. Set the other inputs
as the [Terraform README](../../infra/terraform/README.md#shared-foundation)
shows:

```sh
export MKC_REPOSITORY_ID="$(gh api repos/mokly-ai/mokly --jq .id)"
export MKC_REPOSITORY_OWNER_ID="$(gh api repos/mokly-ai/mokly --jq .owner.id)"
export MKC_LEGACY_REPOSITORY_ID="$(gh api repos/mokly-ai/mokly-cloud --jq .id)"
bash infra/scripts/terraform-foundation.sh plan
```

In `.context/plans/foundation/plan.txt`, expect an in-place update of the
provider condition, 8 new bindings under `mokly-ai/mokly/`, and 8 bindings that
move to `mokly-ai/mokly-cloud/` keys without a change. Stop at a delete, a
replacement or a change outside `module.github`, and find its cause. Then run
`bash infra/scripts/terraform-foundation.sh apply`. Check: the same script with
`check` exits 0, and this prints a clause for `mokly-ai/mokly` (ID `1305675953`)
and one for `mokly-ai/mokly-cloud` (ID `1368694702`):

```sh
gcloud iam workload-identity-pools providers describe github --location=global \
  --workload-identity-pool=mkc-github --project=mokly-508518 --format='value(attributeCondition)'
```

### Copy The Secrets

`grep -h -o -E "secrets\.[A-Z0-9_]+" .github/workflows/*.yml | sort -u` lists
the 16 secrets that the workflows read. Compare `gh secret list` for both
repositories, and set each missing one here from its source:

| Secret                                                                | Source                                                                                                               |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` and the five `GCP_*_SERVICE_ACCOUNT` | The foundation outputs, which are resource names. Use the commands below                                             |
| `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY`                       | The restore command of [Desktop release secrets](./secrets.md#desktop-release-secrets), with `--repo mokly-ai/mokly` |
| `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`                                | App Store Connect                                                                                                    |
| `DESKTOP_RELEASES_TOKEN`                                              | The secure copy, or a new fine-grained token with contents write on `mokly-ai/mokly-desktop` only                    |
| `CLOUDFLARE_PAGES_API_TOKEN`, `CLOUDFLARE_API_TOKEN`                  | Keep the value here, or create a token. It needs Cloudflare Pages Edit on the account of `mokabook` and `mokly-site` |
| `RELEASE_PLEASE_TOKEN`, `DEPENDENCY_AUDIT_TOKEN`                      | Keep the value here. Only Mokly workflows read them                                                                  |

The trust step initialized the foundation root. Set the GCP secrets from it:

```sh
root=infra/terraform/foundation
terraform -chdir="$root" output -raw workload_identity_provider |
  gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER -R mokly-ai/mokly
for pair in PLAN:plan APPLY:apply DEPLOY:deploy POSTMARK_SYNC:postmark FOUNDATION:foundation; do
  terraform -chdir="$root" output -json github_service_accounts |
    python3 -c 'import json,sys; print(json.load(sys.stdin)[sys.argv[1]], end="")' "${pair#*:}" |
    gh secret set "GCP_${pair%%:*}_SERVICE_ACCOUNT" -R mokly-ai/mokly
done
```

Set each other secret with `gh secret set NAME -R mokly-ai/mokly`, which reads
the value from standard input. `gh api repos/mokly-ai/mokly-cloud/actions/organization-secrets`
and `.../organization-variables` list the organization values of the old
repository. A public repository gets only those with **All repositories** or
**Selected repositories** access. Add this repository to each one that a
workflow reads, with `gh api -X PUT orgs/mokly-ai/actions/secrets/NAME/repositories/1305675953`
or `.../variables/...`. Check: `gh secret list -R mokly-ai/mokly` and
`gh api repos/mokly-ai/mokly/actions/organization-secrets` together name all 16.

### Copy The Variables

The workflows read 22 variables: change `secrets` to `vars` in the `grep` above.
[Prerequisites](./deploy.md#prerequisites) describes each. The site and the
Pages previews of the Mokly example share `CLOUDFLARE_ACCOUNT_ID`, so
`gh variable get CLOUDFLARE_ACCOUNT_ID -R NAME` must print the same account for
both repositories, or find none here. When it differs, stop. Then copy the
variables. Add `MKC_LEGACY_REPOSITORY_ID`, which keeps the old bindings in
Terraform until [the old repository retires](./repository-retirement.md).
Without it, the first Foundation run plans to delete them and fails.

```sh
gh variable list -R mokly-ai/mokly-cloud --json name,value --jq '.[] | "\(.name) \(.value | @base64)"' |
  while read -r name value; do
    printf '%s' "$value" | base64 --decode | gh variable set "$name" -R mokly-ai/mokly
  done
gh variable set MKC_LEGACY_REPOSITORY_ID -R mokly-ai/mokly --body "$(gh api repos/mokly-ai/mokly-cloud --jq .id)"
# Check: prints "> MKC_LEGACY_REPOSITORY_ID=1368694702" and no line that starts with "<".
diff <(gh variable list -R mokly-ai/mokly-cloud --json name,value --jq '.[] | "\(.name)=\(.value)"' | sort) \
  <(gh variable list -R mokly-ai/mokly --json name,value --jq '.[] | "\(.name)=\(.value)"' | sort)
```

### Copy The Environments And Rules

On 2026-11-19 the old repository had three environments. `production` had the
required reviewer `calummoore` (user ID `4988117`) and a branch policy for
`main`. `preview` and `main-preview` had no rules. The Preview workflow uses
`preview`, and no job uses the other two. Read the current rules with
`gh api repos/mokly-ai/mokly-cloud/environments`, and copy any rule that
differs. Then create the three here:

```sh
gh api -X PUT repos/mokly-ai/mokly/environments/production --input - <<'JSON'
{"reviewers": [{"type": "User", "id": 4988117}],
 "deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
JSON
gh api -X POST repos/mokly-ai/mokly/environments/production/deployment-branch-policies -f name=main -f type=branch
gh api -X PUT repos/mokly-ai/mokly/environments/preview
gh api -X PUT repos/mokly-ai/mokly/environments/main-preview
```

`gh secret list` and `gh variable list` with `-R mokly-ai/mokly-cloud --env NAME`
list the values of an environment. Set each one here with `--env NAME`. Check:
`gh api repos/mokly-ai/mokly/environments` shows the same rules, beside the
`npm` environment of the Mokly release. Also check:

- Like the old ruleset **Require CI on main**, `main` here must require a check
  and block deletion and force pushes. This must print `[false,false,["Required CI"]]`:
  `gh api repos/mokly-ai/mokly/branches/main/protection --jq '[.allow_force_pushes.enabled, .allow_deletions.enabled, .required_status_checks.contexts]'`.
- **Settings → Actions → General** must allow `google-github-actions/auth`,
  `google-github-actions/setup-gcloud`, `dtolnay/rust-toolchain` and `actions/cache`.

### Point The Apps And Previews Here

No App setting names a repository. **Mokly AI** (App ID `4991152`) serves
production and **Mokly (main-preview)** (App ID `4991055`) serves main-preview.
Their callback, setup and webhook URLs name hosts, as [GitHub App](./production.md#github-app)
and [Prerequisites](./deploy.md#prerequisites) show. PR previews disable the App.
Only the installation of each App on `mokly-ai` can limit its repositories.

1. Open `https://github.com/organizations/mokly-ai/settings/installations`. For
   each App, select **Configure**. When **Repository access** is **Only select
   repositories**, add `mokly-ai/mokly`. Check: the page shows **All
   repositories** or lists `mokly-ai/mokly`.
2. Create the label that starts a PR preview. Only the old repository has it:
   `gh label create preview -R mokly-ai/mokly --color 0E8A16 --description "Deploy a provisioned per-PR preview environment"`.
   Check: `gh label list -R mokly-ai/mokly --search preview` prints it.

### Prepare Conductor

Cloud workspaces run the cloud suites only with the
[Testbox tools](../protocol/ci-workflow-cloud.md#cloud-testbox-tools). A
Conductor organization admin adds them on **Settings → Cloud computer**
(`https://app.conductor.build/settings/organization/computer`), by hand or with
**Configure with an agent**. Cloud workspaces ignore `.conductor/` and
`conductor.json`. The current setup script of this repository installs only the
shared skills. The computer runs Amazon Linux 2023 without systemd.

1. Add this line to the install script under **Install software**, then select
   **Build computer**:
   `sudo dnf install -y postgresql16 postgresql16-server libpq-devel e2fsprogs xorg-x11-server-Xvfb`.
2. Add these lines after the current lines of the **Setup script** of
   `mokly-ai/mokly`. They install the pinned tools, start BuildKit, and start a
   Postgres for the test database `postgres://postgres:postgres@localhost/mkc_test`.

```sh
npm install --global --no-audit --no-fund "$(node -p 'require("./package.json").packageManager')"
bash infra/scripts/install-tools.sh && bash infra/scripts/install-build-tools.sh
(
  cd / && data=/var/lib/pgsql/data
  sudo -u postgres test -s "$data/PG_VERSION" || sudo -u postgres initdb -D "$data" \
    -E UTF8 --locale=C.UTF-8 --auth-local=peer --auth-host=scram-sha-256
  sudo -u postgres pg_ctl -D "$data" status >/dev/null ||
    sudo -u postgres pg_ctl -D "$data" -l /tmp/postgres.log -w start
  sudo -u postgres psql -qc "ALTER ROLE postgres PASSWORD 'postgres'"
  sudo -u postgres createdb mkc_test 2>/dev/null || true
)
bash infra/scripts/start-buildkit.sh
```

Check: in a new cloud workspace of this repository, after `npm ci`, these pass:
`node xtask/scripts/require-postgres.mjs`,
`node xtask/scripts/require-postgres-tools.mjs`, and `cargo xtask check --suite`
with `cloud-toolchain-pins`, `cloud-rust` and `cloud-infrastructure`.

## After The Merge

### Turn On Cloud Delivery

`MKC_CLOUD_CUTOVER_ENABLED` is the switch. Until it equals `true`, no cloud job
of this repository starts, and the Pages previews of the Mokly example stop too.
[Forks and protection](../protocol/ci-workflow-cloud.md#forks-and-protection)
gives the rule. Production promotion also needs `MKC_PRODUCTION_ENABLED=true`.
Set the switch directly after the merge, and hold other merges until step 3
passes. The Foundation and Deploy runs of the merge commit ran without the
switch, so their result jobs print `SKIP cloud delivery: off until cutover`. Do
not re-run them. Steps 2 and 3 start new runs.

1. Run `gh variable set MKC_CLOUD_CUTOVER_ENABLED -R mokly-ai/mokly --body true`.
   Check: `gh variable get MKC_CLOUD_CUTOVER_ENABLED -R mokly-ai/mokly` prints `true`.
2. Run `gh workflow run foundation.yml -R mokly-ai/mokly --ref main`. Check: the
   run passes, which proves the trust here, and `plan-foundation` has no changes.
3. After Foundation passes, run
   `gh workflow run deploy.yml -R mokly-ai/mokly --ref main`. Check: **Deploy
   main-preview workloads** and **Deploy production workloads** pass. With the
   switch on, a `SKIP` line in **Deployment required** means that a secret is
   missing.
   [Wait failures](./foundation.md#wait-failures) gives the recovery.
4. The next push to `main` must pass **Deploy Main Site**, **Deploy Main
   Preview** and the **Credential-gated infrastructure plan**. The next
   `desktop-v*` tag must pass **Release desktop**.
5. Label a pull request here with `preview`, as
   [Review A Labelled PR](./preview.md#review-a-labelled-pr) shows. Check:
   **Preview required** passes, the comment says **Checks passed**, and its
   **Catalogue** link opens the mockups and their Changes signed out. This
   repository is public, so the comment has no **Open preview** link. To check
   the app, sign in as `preview@mokly.ai`, as
   [Read A Sign-In Link](./preview.md#read-a-sign-in-link) shows. Remove the label.
   Check: the comment changes to **Preview removed**.
