# Publish a Mokly catalogue

This public composite action installs an exact `@mokly/mokly` npm release in
runner temporary storage and runs its `mokly publish` command. It supports any
receiver implementing [upload v1](../../../docs/protocol/mokly-upload.md),
including self-hosted services. It uses no private repository or package API.

The action is maintained here at `mokly-ai/mokly/.github/actions/publish`.
Pin it to a reviewed commit SHA (or a release tag containing this directory).
`version` is required: choose an exact published version containing `publish`;
versions, ranges and `latest` from before this feature cannot provide it. The
feature must be released to npm before remote consumers can use the action.
The installed CLI resolves its exact `@mokly/viewer` dependency from npm; no
separate viewer version input is needed. Installation fails if those versions
disagree. Older CLI releases without that dependency remain supported. The
repository release workflow publishes and verifies the viewer first so the CLI
is installable when released.

## Usage

The example uses repository variables `MOKLY_ENDPOINT` and `MOKLY_VERSION`,
and the secret `MOKLY_TOKEN`. Set `MOKLY_VERSION` to an exact supporting release.
Replace `ACTION_COMMIT_SHA` with the reviewed action commit before use.

```yaml
name: Publish catalogue
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  publish:
    # Fork PRs do not have the upload secret. Do not run untrusted code with it.
    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6.0.3
        with:
          fetch-depth: 0
          ref: ${{ github.event.pull_request.head.sha || github.sha }}
      - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0
        with:
          node-version: 24
      - run: npm ci
      - uses: mokly-ai/mokly/.github/actions/publish@ACTION_COMMIT_SHA
        with:
          version: ${{ vars.MOKLY_VERSION }}
          endpoint: ${{ vars.MOKLY_ENDPOINT }}
          token: ${{ secrets.MOKLY_TOKEN }}
          config: mokly.config.ts
          base: origin/main
```

On pull requests this checks out the actual head commit, so `headSha` identifies
the source branch. With the default checkout merge ref it instead identifies
GitHub's synthetic merge commit. Publish detects branch and PR number from the
Actions environment. Other CI systems can invoke the npm CLI directly.

## Inputs

| Input        | Required | Behavior                                                                      |
| ------------ | -------- | ----------------------------------------------------------------------------- |
| `version`    | yes      | Exact SemVer npm release; ranges, tags and URLs are rejected                  |
| `endpoint`   | yes      | Full receiver HTTP(S) URL                                                     |
| `token`      | yes      | Bearer credential, forwarded only through the environment                     |
| `config`     | no       | Config path relative to the consumer working directory; omission discovers it |
| `base`       | no       | Comparison ref; omission uses the config or `origin/main`                     |
| `no-changes` | no       | `true` omits comparisons; defaults to `false`, conflicts with `base`          |

The action sets up Node 24, but does not check out the consumer, install its
dependencies, fetch history, publish an npm package or comment on pull requests.
Consumer authoring code runs during export, so only grant upload credentials to
trusted workflows. Use a receiver-scoped token through GitHub secrets; do not
pass it in a workflow shell command. The receiver controls repository access.

Success means the receiver accepted the upload; this action has no outputs.
Errors propagate the CLI's nonzero exit code and typed category. The complete
local export remains under the config-relative `.context/mokly-publish` path.

## Development

```bash
npm run build
node --import tsx --test tests/publish_action.test.ts tests/publish_cli.test.ts
npm run package:smoke
```

The action tests run its actual composite shell steps with an injected npm
installer. Packed-consumer smoke tests install the real package archive, run
publish against a local HTTP receiver, and inspect the uploaded tarball.
