//! Inference across own props and shallow-merged variant sets.

use serde_json::{Value, json};

use crate::data::{Props, merge_props};
use crate::diagnostic::{AuthoringKind, Context};
use crate::inference::infer;
use crate::validation::PropValidator;

#[test]
fn empty_arrays_omit_items_and_changed_kinds_form_type_lists() {
    let own: Props = serde_json::from_value(json!({"empty":[],"value":true})).unwrap();
    let variant: Props = serde_json::from_value(json!({"empty":[],"value":"text"})).unwrap();
    let schema = serde_json::to_value(infer(&own, &[variant])).unwrap();
    assert!(schema["properties"]["empty"].get("items").is_none());
    assert_eq!(
        schema["properties"]["value"]["type"],
        json!(["string", "boolean"])
    );
}

#[test]
fn inference_closes_objects_unions_types_and_requires_own_keys() {
    let own: Props = serde_json::from_value(
        json!({"user":{"name":"Ada","plan":"pro"},"items":[],"enabled":true}),
    )
    .unwrap();
    let overrides: Props =
        serde_json::from_value(json!({"user":{"name":"Bob"},"items":[1,"two"],"extra":null}))
            .unwrap();
    let variant = merge_props(&own, &overrides);
    assert_eq!(
        serde_json::to_value(&variant["user"]).unwrap(),
        json!({"name":"Bob"})
    );
    let schema = serde_json::to_value(infer(&own, std::slice::from_ref(&variant))).unwrap();
    assert_eq!(schema["required"], json!(["enabled", "items", "user"]));
    assert_eq!(schema["properties"]["user"]["required"], json!(["name"]));
    assert_eq!(
        schema["properties"]["items"]["items"]["type"],
        json!(["string", "number"])
    );
    let context = Context {
        entry: "entry".into(),
        variant: None,
        kind: AuthoringKind::Html,
    };
    let validator = PropValidator::compile(&schema, &context).unwrap();
    validator
        .validate(&serde_json::to_value(own).unwrap(), &context)
        .unwrap();
    validator
        .validate(&serde_json::to_value(variant).unwrap(), &context)
        .unwrap();
    let mut invalid = schema.clone();
    invalid["additionalProperties"] = Value::Bool(true);
    assert!(PropValidator::compile(&invalid, &context).is_err());
}
