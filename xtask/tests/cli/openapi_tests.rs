//! Operation inventories and protocol reason mentions through the JSON lint.

use serde_json::{Value, json};

use super::openapi_schema_tests::{document, schema_fixture, write_document};
use super::support::{failure, success};

#[test]
fn implemented_operations_need_reasons_but_deferred_operations_may_omit_them() {
    let fixture = schema_fixture();
    let mut document = document();
    document["paths"]["/v1/session"] = json!({"get": {
        "operationId": "getSession", "responses": {"200": {"description": "OK"}}
    }});
    write_document(fixture.as_ref(), &document);
    failure(
        fixture.xtask(&["openapi-lint"]),
        "implemented operation requires x-reasons",
    );
    document["paths"]["/v1/session"]["get"]["x-deferred"] = json!(true);
    write_document(fixture.as_ref(), &document);
    success(fixture.xtask(&["openapi-lint"]));
    for (reasons, diagnostic) in [
        (json!([]), "nonempty array"),
        (json!(["unknown-reason"]), "unknown-reason"),
        (
            json!(["unauthenticated", "unauthenticated"]),
            "duplicate x-reasons",
        ),
        (Value::Null, "nonempty array"),
        (json!([1]), "reason must be a string"),
    ] {
        document["paths"]["/v1/session"]["get"]["x-reasons"] = reasons;
        write_document(fixture.as_ref(), &document);
        failure(fixture.xtask(&["openapi-lint"]), diagnostic);
    }
    document["paths"]["/v1/session"]["get"]["x-reasons"] = json!(["unauthenticated"]);
    write_document(fixture.as_ref(), &document);
    document["paths"]["/v1/session"]["get"]
        .as_object_mut()
        .unwrap()
        .remove("x-deferred");
    write_document(fixture.as_ref(), &document);
    success(fixture.xtask(&["openapi-lint"]));
}

#[test]
fn only_a_true_operation_marker_allows_a_missing_reason_inventory() {
    let fixture = schema_fixture();
    let mut document = document();
    document["x-deferred"] = json!(true);
    document["paths"]["/v1/session"] = json!({"x-deferred": true, "get": {
        "operationId": "getSession"
    }});
    for marker in [json!(false), json!("true"), json!(1), Value::Null] {
        document["paths"]["/v1/session"]["get"]["x-deferred"] = marker;
        write_document(fixture.as_ref(), &document);
        failure(
            fixture.xtask(&["openapi-lint"]),
            "implemented operation requires x-reasons",
        );
    }
    document["paths"]["/v1/session"]["get"]["x-deferred"] = json!(true);
    write_document(fixture.as_ref(), &document);
    success(fixture.xtask(&["openapi-lint"]));
}

#[test]
fn operation_reasons_must_also_appear_in_the_full_error_inventory() {
    let fixture = schema_fixture();
    fixture.write("docs/protocol/cloud/rest-api.md",
        "| `unauthenticated` | `unauthenticated` | 401 | Missing session | — |\n| `not-found` | `not-found` | 404 | Missing | — |\n");
    let mut document = document();
    document["paths"]["/v1/project"] = json!({"get": {
        "operationId": "getProject", "x-reasons": ["not-found"]
    }});
    write_document(fixture.as_ref(), &document);
    failure(fixture.xtask(&["openapi-lint"]), "not-found");
}

#[test]
fn reserved_and_deferred_reasons_are_allowed_only_on_deferred_operations() {
    let fixture = schema_fixture();
    let mut document = document();
    document["components"]["schemas"]["Error"]["x-reasons"] = json!(["plan-required"]);
    document["paths"]["/v1/project"] = json!({"patch": {
        "operationId": "updateProject", "x-reasons": ["plan-required"]
    }});
    write_document(fixture.as_ref(), &document);
    for state in ["Reserved", "Deferred"] {
        fixture.write("docs/protocol/cloud/rest-api.md", &format!(
            "| `plan-required` | `failed-precondition` | 400 | {state}: private projects | — |\n"));
        document["paths"]["/v1/project"]["patch"]
            .as_object_mut()
            .unwrap()
            .remove("x-deferred");
        write_document(fixture.as_ref(), &document);
        failure(
            fixture.xtask(&["openapi-lint"]),
            "updateProject declares reserved reason plan-required",
        );
        document["paths"]["/v1/project"]["patch"]["x-deferred"] = json!(true);
        write_document(fixture.as_ref(), &document);
        success(fixture.xtask(&["openapi-lint"]));
    }
}

#[test]
fn protocol_mentions_reject_unknown_and_misspelled_reasons() {
    let fixture = schema_fixture();
    fixture.write("docs/protocol/cloud/rest-api.md", "| `unauthenticated` | `unauthenticated` | 401 | Missing session | — |\n| `token-revoked` | `unauthenticated` | 401 | Revoked token | — |\n");
    for path in [
        "docs/protocol/cloud/platform-model.md",
        "docs/protocol/cloud/rest-api.md",
    ] {
        for mention in [
            "Returns `unknown-reason`.",
            "The reason `already_member` is invalid.",
            "Uses `token_revoked`.",
        ] {
            let catalogue = "| `unauthenticated` | `unauthenticated` | 401 | Missing session | — |\n| `token-revoked` | `unauthenticated` | 401 | Revoked token | — |\n";
            fixture.write(path, &format!("{catalogue}\n{mention}"));
            failure(fixture.xtask(&["openapi-lint"]), "invalid OpenAPI reason");
        }
        fixture.write(
            path,
            "| `unauthenticated` | `unauthenticated` | 401 | Missing session | — |\n",
        );
    }
}

#[test]
fn cli_outcomes_are_not_returned_rest_reasons_in_protocol_prose() {
    let fixture = schema_fixture();
    let prose = "docs/protocol/cloud/mockup-baselines.md";
    for mention in [
        "Mokly returns `baseline-incompatible-earlier`.\n",
        "Mokly returns\n`baseline-incompatible-earlier`.\n",
    ] {
        fixture.write(prose, mention);
        failure(
            fixture.xtask(&["openapi-lint"]),
            "baseline-incompatible-earlier",
        );
    }
    for mention in [
        "Mokly classifies the base as `baseline-incompatible-earlier`.\n",
        "Mokly returns\n\n`baseline-incompatible-earlier` is a CLI outcome.\n",
        "Mokly returns\n```text\nbaseline-incompatible-earlier\n```\n`baseline-incompatible-earlier` is a CLI outcome.\n",
    ] {
        fixture.write(prose, mention);
        success(fixture.xtask(&["openapi-lint"]));
    }
}
