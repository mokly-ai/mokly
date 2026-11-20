//! The cloud reason check reads moved cloud docs and GitHub delivery fixtures.

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::policy::diagnostic::Violation;
use crate::policy::environment::{FilesMock, ReadMock};

use super::{OpenapiCheck, OpenapiValidator};

#[test]
fn cloud_reason_lint_uses_cloud_protocols_and_requires_subscribed_delivery_fixtures() {
    let environment = Arc::new(Unimock::new((
        FilesMock.some_call(matching!()).returns(Ok(vec![
            "docs/protocol/cli.md".into(),
            "docs/protocol/cloud/rest-api.md".into(),
            "docs/protocol/cloud/github-app.md".into(),
        ])),
        ReadMock.each_call(matching!(_)).answers(&|_, path| Ok(match path.to_str().unwrap() {
            "docs/api/openapi.json" => r#"{"paths":{},"components":{"schemas":{"Error":{"x-reasons":["unauthenticated"]}}}}"#,
            "docs/protocol/cloud/rest-api.md" => "| `unauthenticated` | `unauthenticated` | 401 | Missing session | — |\n",
            "docs/protocol/cloud/github-app.md" => "Subscribe to `push`.\n",
            "docs/protocol/cli.md" => "The CLI returns `bundle-failed`.\n",
            _ => "",
        }.as_bytes().to_vec())),
    )));
    let result = OpenapiCheck { environment }.check();
    let Err(Error::Violations(violations)) = result else {
        panic!("expected a missing delivery fixture: {result:?}");
    };
    assert_eq!(
        violations,
        [Violation::GitHubDeliveryFixture("push".into())]
    );
}
