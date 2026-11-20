//! Subscription inventory regressions through the real OpenAPI lint command.

use super::openapi_schema_tests::schema_fixture;
use super::support::{failure, success};

#[test]
fn every_subscription_requires_its_own_delivery_fixture() {
    let fixture = schema_fixture();
    fixture.write(
        "docs/protocol/cloud/github-app.md",
        "# GitHub App\n\nSubscribe to `installation`,\n`installation_repositories`, `repository`.\n",
    );
    fixture.write(
        "crates/mkc-api/tests/fixtures/github/installation-repositories.json",
        "{}\n",
    );
    for event in ["installation", "repository"] {
        failure(
            fixture.xtask(&["openapi-lint"]),
            &format!("missing GitHub delivery fixture for subscribed event: {event}"),
        );
    }
    fixture.write(
        "crates/mkc-api/tests/fixtures/github/installation-created.json",
        "{}\n",
    );
    fixture.write(
        "crates/mkc-api/tests/fixtures/github/repository-renamed.json",
        "{}\n",
    );
    success(fixture.xtask(&["openapi-lint"]));
    fixture.write(
        "docs/protocol/cloud/github-app.md",
        "# GitHub App\n\nSubscribe to `installation`, `installation_repositories`, `repository`, `workflow_run`.\n",
    );
    fixture.write("elsewhere/workflow-run.json", "{}\n");
    fixture.write(
        "crates/mkc-api/tests/fixtures/github/workflow-run.md",
        "# Not a JSON delivery\n",
    );
    failure(
        fixture.xtask(&["openapi-lint"]),
        "missing GitHub delivery fixture for subscribed event: workflow_run",
    );
    fixture.write(
        "crates/mkc-api/tests/fixtures/github/workflow-run-completed.json",
        "{}\n",
    );
    success(fixture.xtask(&["openapi-lint"]));
}

#[test]
fn missing_or_malformed_subscription_lists_fail_closed() {
    let fixture = schema_fixture();
    for protocol in [
        "# GitHub App\n",
        "Subscribe to nothing.\n",
        "Subscribe to `push`. Subscribe to `repository`.\n",
        "Subscribe to `push.\n",
        "Subscribe to `push`\n",
        "Subscribe to `push`, repository.\n",
        "Subscribe to `push`, `push`.\n",
    ] {
        fixture.write("docs/protocol/cloud/github-app.md", protocol);
        failure(
            fixture.xtask(&["openapi-lint"]),
            "invalid GitHub subscription list",
        );
    }
}
