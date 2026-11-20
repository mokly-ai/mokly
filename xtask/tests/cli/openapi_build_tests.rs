//! Build refusal inventories remain required by the JSON contract lint.

use serde_json::{Value, json};

use super::openapi_schema_tests::write_document;
use super::support::{Fixture, FixtureFactory, TemporaryFixtures, failure, success};

fn build_fixture() -> Box<dyn Fixture> {
    let factory: &dyn FixtureFactory = &TemporaryFixtures;
    let fixture = factory.create();
    fixture.write(
        "docs/protocol/cloud/rest-api.md",
        &[
            "builds-unavailable",
            "build-ineligible",
            "build-already-active",
            "build-already-published",
            "plan-required",
        ]
        .map(|reason| format!("| `{reason}` | `failed-precondition` | 400 | Build refusal | — |\n"))
        .concat(),
    );
    write_document(fixture.as_ref(), &document());
    fixture
}

#[test]
fn build_refusals_and_plan_required_must_stay_in_the_error_inventory() {
    let fixture = build_fixture();
    success(fixture.xtask(&["openapi-lint"]));
    let source = document();
    for reason in [
        "builds-unavailable",
        "build-ineligible",
        "build-already-active",
        "build-already-published",
        "plan-required",
    ] {
        let mut removed = source.clone();
        let inventory = removed["components"]["schemas"]["Error"]["x-reasons"]
            .as_array_mut()
            .unwrap();
        let count = inventory.len();
        inventory.retain(|value| value != reason);
        assert_eq!(inventory.len() + 1, count);
        write_document(fixture.as_ref(), &removed);
        failure(fixture.xtask(&["openapi-lint"]), reason);
    }
}

fn document() -> Value {
    json!({"openapi":"3.1.0","paths":{"/builds":{"post":{"operationId":"createBuild","x-reasons":[
        "builds-unavailable", "build-ineligible", "build-already-active",
        "build-already-published", "plan-required"
    ]}}},"components":{"schemas":{"Error":{"x-reasons":[
        "builds-unavailable", "build-ineligible", "build-already-active",
        "build-already-published", "plan-required"
    ]}}}})
}
