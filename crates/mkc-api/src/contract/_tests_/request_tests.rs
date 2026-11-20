//! Optional request fields keep absence semantics without accepting null in the contract.

#![allow(clippy::unwrap_used)]

use serde_json::{Value, json};

use crate::github::input::{Install, Start};
use crate::input::MagicLink;

use super::response_validation::{document, validator_at};

#[test]
fn webhook_request_schemas_are_explicitly_open_objects() {
    for path in ["/v1/github/webhooks", "/v1/billing/webhooks"] {
        let pointer = format!(
            "/paths/{}/post/requestBody/content/application~1json/schema",
            path.replace('/', "~1")
        );
        let schema = document().pointer(&pointer).unwrap();
        assert_eq!(schema["type"], "object", "{path}");
        assert_eq!(schema["additionalProperties"], true, "{path}");
        assert!(validator_at(&pointer).is_valid(&json!({
            "providerField": {"nested": [1, true, null, "value"]}
        })));
    }
}

#[test]
fn serde_optional_inputs_stay_optional_and_nonnullable() {
    assert!(
        serde_json::from_value::<MagicLink>(json!({"email":"person@example.com"}))
            .unwrap()
            .return_to
            .is_none()
    );
    assert!(
        serde_json::from_value::<Start>(json!({}))
            .unwrap()
            .return_to
            .is_none()
    );
    assert!(
        serde_json::from_value::<Install>(
            json!({"workspaceId":"00000000-0000-0000-0000-000000000000"})
        )
        .unwrap()
        .return_to
        .is_none()
    );
    for (component, field) in [
        ("MagicLinkRequest", "returnTo"),
        ("Start", "returnTo"),
        ("Install", "returnTo"),
    ] {
        let schema = &document()["components"]["schemas"][component];
        assert!(
            !schema["required"]
                .as_array()
                .is_some_and(|required| required.contains(&json!(field)))
        );
        assert!(
            !validator_at(&format!(
                "/components/schemas/{component}/properties/{field}"
            ))
            .is_valid(&Value::Null)
        );
    }
}

#[test]
fn no_optional_request_property_becomes_nullable() {
    let mut checked = 0;
    for (path, item) in document()["paths"].as_object().unwrap() {
        for (method, operation) in item.as_object().unwrap() {
            if operation.get("requestBody").is_some() {
                let pointer = format!(
                    "/paths/{}/{method}/requestBody/content/application~1json/schema",
                    path.replace('/', "~1")
                );
                if let Some(schema) = document().pointer(&pointer) {
                    checked += inspect(schema, &pointer);
                }
            }
        }
    }
    assert!(checked > 0);
}

fn inspect(schema: &Value, pointer: &str) -> usize {
    if let Some(reference) = schema["$ref"].as_str() {
        let pointer = reference.strip_prefix('#').unwrap();
        return inspect(document().pointer(pointer).unwrap(), pointer);
    }
    let mut checked = 0;
    if let Some(properties) = schema["properties"].as_object() {
        for (name, property) in properties {
            let child = format!("{pointer}/properties/{name}");
            let required = schema["required"]
                .as_array()
                .is_some_and(|fields| fields.contains(&json!(name)));
            if !required {
                assert!(
                    !validator_at(&child).is_valid(&Value::Null),
                    "nullable optional input: {child}"
                );
                checked += 1;
            }
            checked += inspect(property, &child);
        }
    }
    for keyword in ["allOf", "oneOf", "anyOf"] {
        for (index, branch) in schema[keyword].as_array().into_iter().flatten().enumerate() {
            checked += inspect(branch, &format!("{pointer}/{keyword}/{index}"));
        }
    }
    checked
}
