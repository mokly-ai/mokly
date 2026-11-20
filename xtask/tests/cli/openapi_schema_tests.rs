//! JSON reason inventory fixtures shared by the lint's CLI tests.

use serde_json::{Value, json};

use super::support::{Fixture, FixtureFactory, TemporaryFixtures, failure, success};

pub(super) fn schema_fixture() -> Box<dyn Fixture> {
    let factory: &dyn FixtureFactory = &TemporaryFixtures;
    let fixture = factory.create();
    fixture.write(
        "docs/protocol/cloud/rest-api.md",
        "| `unauthenticated` | `unauthenticated` | 401 | Missing session | — |\n",
    );
    write_document(fixture.as_ref(), &document());
    fixture
}

pub(super) fn document() -> Value {
    json!({"openapi": "3.1.0", "paths": {}, "components": {"schemas": {
        "Error": {"x-reasons": ["unauthenticated"]}
    }}})
}

pub(super) fn write_document(fixture: &dyn Fixture, document: &Value) {
    fixture.write(
        "docs/api/openapi.json",
        &serde_json::to_string_pretty(document).unwrap(),
    );
}

#[test]
fn rejects_uncatalogued_malformed_duplicate_and_empty_inventories() {
    let fixture = schema_fixture();
    for (inventory, diagnostic) in [
        (json!(["unknown-reason"]), "unknown-reason"),
        (
            json!(["unauthenticated", "unauthenticated"]),
            "duplicate x-reasons",
        ),
        (json!([]), "nonempty array"),
        (json!("unauthenticated"), "nonempty array"),
        (json!([42]), "reason must be a string"),
        (Value::Null, "nonempty array"),
    ] {
        let mut document = document();
        document["components"]["schemas"]["Error"]["x-reasons"] = inventory;
        write_document(fixture.as_ref(), &document);
        failure(fixture.xtask(&["openapi-lint"]), diagnostic);
    }
    write_document(fixture.as_ref(), &document());
    success(fixture.xtask(&["openapi-lint"]));
}

#[test]
fn descriptions_can_only_mention_catalogued_inventory_reasons() {
    let fixture = schema_fixture();
    let mut document = document();
    document["components"]["schemas"]["Error"]["description"] = json!("Returns `unknown-reason`.");
    write_document(fixture.as_ref(), &document);
    failure(fixture.xtask(&["openapi-lint"]), "unknown-reason");
    document["components"]["schemas"]["Error"]["description"] = json!("Returns `unauthenticated`.");
    write_document(fixture.as_ref(), &document);
    success(fixture.xtask(&["openapi-lint"]));
}

#[test]
fn malformed_duplicate_and_missing_rest_rows_are_rejected() {
    let fixture = schema_fixture();
    let row = "| `unauthenticated` | `unauthenticated` | 401 | Missing session | — |\n";
    for catalogue in [
        String::new(),
        row.replace("unauthenticated", "bad_name"),
        row.repeat(2),
        row.replace(" | —", ""),
    ] {
        fixture.write("docs/protocol/cloud/rest-api.md", &catalogue);
        failure(fixture.xtask(&["openapi-lint"]), "REST reason");
    }
}

#[test]
fn malformed_json_fails_with_its_parse_context() {
    let fixture = schema_fixture();
    fixture.write("docs/api/openapi.json", "{");
    failure(fixture.xtask(&["openapi-lint"]), "parse OpenAPI JSON");
}
