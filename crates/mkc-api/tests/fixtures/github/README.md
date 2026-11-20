# GitHub delivery fixtures

Sanitized delivery bodies for the real HTTP/Postgres smoke in `tests/github/`.
These contain public example data, never deployment credentials. The HTTP
double's response provenance is in
[mkc-github fixtures](../../../../mkc-github/fixtures/README.md).

`repository-renamed.json` preserves the complete structure of Octokit's
[published repository rename delivery](https://github.com/octokit/webhooks/blob/7dd7fa56498a827a08b71919fae89428f5e8e283/payload-examples/api.github.com/repository/renamed.payload.json),
including its top-level `installation`, `organization`, `sender` and
`changes.repository.name.from`. Account/repository IDs, node IDs, names, URLs
and dates are sanitized to the smoke identities; `Renamed` is the new name
and `Hello-World` the previous name. Unknown fields and nulls remain intact.
This is a sanitized published example, not a live Mokly App capture.

The fixture registry returns its bytes for `delivery("repository")`. The
lifecycle test reuses that repository-event shape with each supported action
and verifies the current provider snapshot wins over delayed payload data.
The new-repository test removes rename-only `changes` and uses an unseen ID
to exercise an all-repositories installation before any selection delivery.

`repository-edited.json` derives from the sanitized repository recording and
Octokit's published `repository/edited` example shape. It retains the
installation scope and records `changes.default_branch.from`. The smoke
changes the provider's default branch and proves the current snapshot wins.
It is a sanitized published-example fixture, not a live App capture.

Each event in the `Subscribe to` list in
[GitHub App](../../../../../docs/protocol/cloud/github-app.md) needs a `.json` file
here. Convert underscores to hyphens; an optional action suffix follows the
event name. The longest subscribed event prefix owns a filename, preventing
`installation-repositories.json` from also covering `installation`.
`cargo xtask openapi-lint` enforces this coverage. Register new fixtures in
`tests/github/fixtures.rs` and replay them through the endpoint and worker.

```sh
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test \
  RUSTC_WRAPPER= cargo test -p mkc-api --test github_tests -- --nocapture
RUSTC_WRAPPER= cargo xtask openapi-lint
```
