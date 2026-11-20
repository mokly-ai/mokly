# GitHub HTTP response fixtures

These checked-in records are sanitized examples modeled on GitHub's documented
REST response bodies and headers. They are not authenticated live captures.
The fictitious account/repository IDs, dates, request IDs and tokens are test
data; the RSA key pair was generated exclusively for JWT tests and is not an
App credential. Never replace fixture secrets with deployment credentials.

Each JSON record retains HTTP status, response headers and the JSON body. Rate
limit cases include primary exhaustion, secondary 403 with `Retry-After`, and
ordinary permission denial. Tests validate requests against the record script,
including token selection, methods, escaped paths, PKCE fields and check output.
`check-list.json` retains the `total_count` and `check_runs` response shape.
Recovery tests require the name, App and `filter=all` query parameters.
The API's loopback double replays these shapes with a current token expiry and
reset time; event bodies and their provenance live in
[mkc-api/tests/fixtures/github](../../mkc-api/tests/fixtures/github/README.md).
The repository lifecycle smoke uses Octokit's published rename delivery with
its original changes/installation structure. Subscription coverage is checked
by `cargo xtask openapi-lint`.

`repository-token.json` models the 201 installation-token response for
one selected repository with Contents read and implicit Metadata read. Tests
assert the repository-ID and permissions request and prove it bypasses the
shared token cache. PR detail/list records retain `head.repo.id` and
`base.repo.id`; a missing head repository is tested as null.

`installation-organization.json`, `repositories-organization.json` and
`organization-membership.json` model a second installation on `fixture-org`,
its one repository and the OAuth user's active administrator membership.

When updating, preserve GitHub's real field names, nullability, status behavior
and pagination shapes. Sanitize values, retain unknown fields to exercise
forward compatibility, and run both the provider and API GitHub suites.

Sources: [installations](https://docs.github.com/en/rest/apps/installations),
[checks](https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference),
[pull requests](https://docs.github.com/en/rest/pulls/pulls),
[rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api),
[user OAuth tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app).
