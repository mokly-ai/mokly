# Dependency Update Pull Request

## Delivery Status

The scheduled strict workflow and update script are implemented. They create,
refresh, and close update pull requests under this contract. Unit tests use
injected boundaries. Local smoke tests use a temporary Git remote and API server.
The `sharp` and `shell-quote` fixes already landed on `main` in
[PR #146](https://github.com/mokly-ai/mokly/pull/146). The strict audit passes
with the reviewed `braces` exception. This workflow owns future audit failures.

## Workflow Boundary

`.github/workflows/dependency-audit.yml` runs daily off the hour and on
`workflow_dispatch`. It has one job on `blacksmith-2vcpu-ubuntu-2404` with a
30-minute timeout. Use concurrency group `dependency-audit` and do not cancel
an active run. Grant `contents: write`, `pull-requests: write`, and
`issues: write`. Actions use immutable revisions with reviewed version comments.

Check out `main` with `fetch-depth: 0` and this checkout token:

```yaml
token: ${{ secrets.DEPENDENCY_AUDIT_TOKEN || github.token }}
```

Set up Node 24 and npm 11.21.0, the exact `packageManager` version that
`tests/npm_pin.test.ts` requires. The strict audit uses only the root lockfile,
so do not run `npm ci` before it. Its step has an `id`,
`continue-on-error: true`, and `shell: bash` or explicit `set -o pipefail`.
GitHub's explicit Bash shell includes pipefail. Create `.context/` before
`tee` opens its log:

```bash
mkdir -p .context
npm run dependencies:check -- --report .context/dependency-audit.json 2>&1 | tee .context/dependency-audit.log
```

Pipefail preserves a failed audit's original step outcome. The next step runs
the update script with `steps.<audit-id>.outcome`, not its conclusion after
`continue-on-error`, plus the log and JSON report paths. Give that step the
same token expression as `GITHUB_TOKEN`, and pass `GITHUB_REPOSITORY`,
`GITHUB_SERVER_URL`, and `GITHUB_RUN_ID` through environment variables.

A strict failure caused only by uncovered findings or exception issues is
handled by the update pull request. Creating or refreshing that pull request
is a successful scheduled run. Command, registry, report, input, Git, npm,
and GitHub API failures fail the scheduled run with an action message.

## Inputs And Failure Classification

The entry point is `scripts/verification/dependency-audit-pr.mjs`:

```bash
node scripts/verification/dependency-audit-pr.mjs --outcome failure --log .context/dependency-audit.log --report .context/dependency-audit.json
```

`--outcome` accepts `success` or `failure`. `--log` names the captured text
file. `--report` names the JSON summary written by `dependency-audit.mjs`
under the [baseline audit contract](./dependency-audit-baseline.md#output-and-json-summary).
The four workflow environment variables above are required. Unit tests inject
file reads, the clock, `fetch`, and the command runner. They never call the
registry or GitHub.
Require a non-empty token, an `owner/repository` name without `.` or `..`
path segments, a numeric run ID, and an HTTP server URL without embedded
credentials, a query, or a fragment. Reject unknown or repeated CLI options.

`GITHUB_API_URL` is optional and defaults to `https://api.github.com`.
Actions supplies it for its REST server, including GitHub Enterprise.
REST calls send Bearer authentication, `Accept: application/vnd.github+json`,
`X-GitHub-Api-Version: 2022-11-28`, and a User-Agent. Errors name the method,
path, status, and GitHub message. Never print the token or request headers.
Discover open requests with `GET /repos/{owner}/{repo}/pulls?state=open&head={owner}:dependency-audit/main`.
Follow next-page links only on the API URL's origin and base path, with the
remaining path `/repos/{owner}/{repo}/pulls` or `/repositories/<digits>/pulls`.
Verify each request's repository and head.

Before any Git or GitHub mutation, read and validate the summary and log.
The summary must have `mode: strict`, boolean `ok`, and a structured `issues`
array. Its `ok` must agree with an empty or non-empty issue list. Required
issue fields follow the audit contract. The outcome is `success` exactly
when `ok` is true. A baseline-mode summary cannot prove `main` is clean.

Do not create, refresh, or close a pull request when the report is missing
or invalid, its outcome disagrees with `--outcome`, or any issue is `report`
or `input`. Fail with a message that identifies the problem and tells the
maintainer to fix the input or restore the command or registry and retry.
This includes invalid JSON, npm error objects, signals, unexpected exit
statuses, and file failures reported by the audit. Exception-only failures
remain actionable audit failures and may create an empty tracking commit.

Any non-2xx API response or failed command fails the script. Append the
operation and cause to an action message. A failed update must not appear as
successful maintenance.

## Pull Request Identity And Body

The branch is `dependency-audit/main`. The label is `dependency-audit`;
create it after a 404 lookup and accept a 422 "already exists" race.
Add it through the issues labels endpoint. The title is
`fix(deps): resolve dependency audit findings`. Create, refresh, and close
select only open pull requests whose head is `dependency-audit/main` in this
repository. The label is a marker and a strict-CI signal; it does not identify
pull requests to close. Adding the label does not start CI. It takes effect at
the next `opened`, `synchronize`, or `reopened` pull request event. After
labelling, a maintainer pushes a commit or closes and reopens the pull request.
The bot pull request already selects strict mode from its head ref.
Use the `github-actions[bot]`
Git author and committer identity with email
`41898282+github-actions[bot]@users.noreply.github.com`.

Replace the pull request body with the latest audit evidence:

- The UTC run date.
- A run URL built from server URL, repository, and run ID.
- The captured audit log in a fenced block. When truncating, keep its final
  part and put a visible truncation notice before that retained log tail.
- A link to this protocol page.
- The actions to fix dependencies, change a pinned-parent override after
  review, or request an exact dev-only reviewed exception.
- This required action in every body: "If CI did not start on this pull
  request, push a commit to the branch or close and reopen the pull request."

GitHub's pull request body limit is 65,536 UTF-16 code units. The complete body must
stay within that limit, including the date, links, fences, truncation notice,
and actions. Reserve room for those fields before selecting the log tail.
Do not split a surrogate pair when selecting the tail. Use a backtick fence
longer than every backtick run in the retained log. Do not extend exception
dates automatically. The update pull request stays on strict CI until the
branch resolves every issue under the unchanged exception rules.

## Create Or Recreate

On a valid failing audit with no open update pull request:

1. Read current `main` and the remote update branch, if present.
2. If that branch exists, inspect every commit beyond current `main`.
3. Create or recreate the branch from current `main` when it is absent or
   every such commit belongs to the bot. An empty commit set qualifies.
4. Run `npm ci --ignore-scripts` to start from the installed tree.
5. Run `npm update <package> --ignore-scripts` for each distinct package in
   uncovered findings. Use compatible updates within existing constraints.
6. Fail if any `package.json` changed, including a workspace manifest.
7. Commit a lockfile change as `fix(deps): update audited dependencies`, or
   an empty commit as `chore(deps): track dependency audit findings`.
8. Push and open the labelled pull request with its latest body.

Read the remote tip with `git ls-remote`, fetch it, and inspect its
`origin/main..<tip>` commits with `git rev-list` and `git log`.
The bot-only test checks both author and committer against the exact name
and email above. Read actual branch history; do not infer ownership from a
branch name, label, or pull request author. When recreating an existing
branch, force-push with a lease for the inspected remote tip. For a new branch,
use `--force-with-lease=refs/heads/dependency-audit/main:` to require absence. A concurrent
change must fail the push instead of overwriting a human commit.

If the branch exists without an open pull request and contains a non-bot
commit, list the closed pull requests whose head is `dependency-audit/main` in
this repository. When one of them has the inspected tip as its head commit,
GitHub keeps those commits at `refs/pull/<number>/head`, so the branch is
recoverable. Recreate it from current `main` with a lease for the inspected
tip, and open a new pull request whose body links the closed one. This covers
a pull request that the script closed on a clean audit and a merged pull
request whose branch remains. Otherwise fail before recreating the branch.
Name `dependency-audit/main` and tell a maintainer to delete the branch or
reopen its pull request.

Run all Git and npm child processes without `GITHUB_TOKEN` or `GH_TOKEN`.
Both install and update commands use `--ignore-scripts` because a lockfile
update needs no dependency lifecycle code. The script retains the token for
its GitHub API calls. Checkout supplies the same token for Git pushes.

## Refresh

On a valid failing audit with an open update pull request, inspect every
commit on the remote branch beyond current `main` with the same bot-only
test. When all qualify, recreate from `main`, run the create sequence, and
force-push with a lease for the inspected tip. This removes stale bot updates
and attempts the current compatible fixes.

When any commit belongs to a human, preserve the branch. Do not run an
update, commit, or push on it. Replace the body with the latest evidence in
either case. A maintainer's override or reviewed exception thus remains on
the update branch while the scheduled run reports current `main` findings.

## Close

On a valid strict success, comment on and close only open pull requests whose
head is `dependency-audit/main` in this repository. The comment links to the
clean run. Leave other pull requests open, including ones with the
`dependency-audit` label. Delete
`dependency-audit/main` only when every commit beyond current `main` passes
the bot-only test, including when there are none. Preserve a branch with
human commits; its closed pull request keeps them, so a later failing audit
recreates the branch under the closed pull request rule above. Delete with a leased Git push for the inspected tip, never
through the REST API. If no update pull request or branch exists, success creates
nothing. Report or operational failures never close pull requests.

## Token Ownership And Rotation

Pull requests opened with `github.token` do not trigger `pull_request`
workflows. Branch pushes made with that token do not trigger CI either.
Checkout and API calls must both use
`secrets.DEPENDENCY_AUDIT_TOKEN || github.token`; otherwise a refreshed
pull request would not run CI.

The secret holds a fine-grained personal access token restricted to this
repository with these repository permissions:

| Permission    | Access         | Purpose                                                      |
| ------------- | -------------- | ------------------------------------------------------------ |
| Contents      | Read and write | Read, push, and delete the update branch.                    |
| Pull requests | Read and write | Open, update, comment on, and close pull requests.           |
| Issues        | Read and write | Create the dependency audit label.                           |
| Workflows     | Read and write | Push a refreshed branch after `main` changed workflow files. |
| Metadata      | Read, implicit | Required repository metadata access.                         |

A refresh moves the branch from an older `main` to the current one. GitHub
rejects that push when it changes `.github/workflows/` and the token has no
Workflows permission. The script still commits only `package-lock.json`.
Grant no account permission. A personal token is limited by its owner's write
access. The owner is the pull request author and cannot approve that pull
request. If the organization requires fine-grained token approval, an
organization owner approves it.

A GitHub App installation token expires after one hour, so the secret cannot
hold one. An app needs a workflow step that creates its installation token
for each run, and this workflow has no such step.

Maintainer `calummoore` created the repository secret on 2026-10-06. The token
has no expiration date, so no scheduled rotation applies. Replace it when it
may be exposed, when its owner loses write access, or when the owner revokes
it. Keep the repository scope and permissions above in every replacement.
A revoked token that stays in the secret fails checkout. Only an empty or
deleted secret selects the `github.token` fallback.

Without the secret, the fallback `github.token` pushes the branch and opens
the pull request only while the repository lets GitHub Actions create pull
requests, as the [maintainer setup](./npm-release-operations.md#maintainer-setup)
requires. It has no Workflows permission, so a refresh across a workflow change
fails. Its pushes and pull requests start no CI. Every pull request body
includes the exact missing-CI recovery action defined above.

Related contracts: [Dependency security](./dependency-security.md),
[CI workflow graph](./ci-workflow.md), and
[CI verification security](./ci-verification-security.md).
