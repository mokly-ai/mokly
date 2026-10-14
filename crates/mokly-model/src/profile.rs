//! Profile restrictions beyond the JSON Schema metaschema.

use serde_json::Value;

use crate::limits::pointer;
use crate::numeric;

const KEYWORDS: &[&str] = &[
    "type",
    "properties",
    "required",
    "additionalProperties",
    "enum",
    "const",
    "oneOf",
    "anyOf",
    "items",
    "minItems",
    "maxItems",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "multipleOf",
    "title",
    "description",
    "$schema",
];

/// Check keyword placement; the jsonschema crate checks keyword value schemas.
pub(crate) fn check(
    value: &Value,
    path: &str,
    root: bool,
) -> std::result::Result<(), (String, &'static str)> {
    let Some(object) = value.as_object() else {
        return Err((path.to_owned(), "schema must be an object"));
    };
    let fail = |key: &str, reason| Err((pointer(path, key), reason));
    if root && value.get("type") != Some(&Value::String("object".into())) {
        return fail("type", "root schema type must be object");
    }
    if !["type", "enum", "const", "oneOf", "anyOf"]
        .iter()
        .any(|key| object.contains_key(*key))
    {
        return Err((
            path.to_owned(),
            "schema must declare type, enum, const, oneOf or anyOf",
        ));
    }
    for key in object.keys() {
        if !KEYWORDS.contains(&key.as_str()) {
            return fail(key, "keyword is outside the prop schema profile");
        }
    }
    let includes = |kind| match value.get("type") {
        Some(Value::String(name)) => name == kind,
        Some(Value::Array(names)) => names.iter().any(|name| name == kind),
        _ => false,
    };
    for (kind, keys) in [
        (
            "object",
            &["properties", "required", "additionalProperties"][..],
        ),
        ("array", &["items", "minItems", "maxItems"][..]),
        ("string", &["minLength", "maxLength"][..]),
    ] {
        for key in keys {
            if object.contains_key(*key) && !includes(kind) {
                return fail(key, "keyword requires its matching type");
            }
        }
    }
    for key in ["minimum", "maximum", "multipleOf"] {
        if let Some(number) = object.get(key) {
            if !includes("number") && !includes("integer") {
                return fail(key, "numeric keyword requires number or integer type");
            }
            if number
                .as_f64()
                .is_some_and(|number| number == 0.0 && number.is_sign_negative())
            {
                return fail(key, "schema bounds cannot be negative zero");
            }
        }
    }
    if includes("object") && value.get("additionalProperties") != Some(&Value::Bool(false)) {
        return fail(
            "additionalProperties",
            "object schemas require additionalProperties: false",
        );
    }
    for (minimum, maximum) in [
        ("minimum", "maximum"),
        ("minItems", "maxItems"),
        ("minLength", "maxLength"),
    ] {
        if let (Some(low), Some(high)) = (
            value.get(minimum).and_then(Value::as_number),
            value.get(maximum).and_then(Value::as_number),
        ) && numeric::greater(low, high)
        {
            return fail(minimum, "lower bound exceeds upper bound");
        }
    }
    if let Some(schema) = value.get("$schema")
        && (!root || schema != "https://json-schema.org/draft/2020-12/schema")
    {
        return fail(
            "$schema",
            "$schema is root-only and must select draft 2020-12",
        );
    }
    if let Some(properties) = value.get("properties").and_then(Value::as_object) {
        for (name, schema) in properties {
            check(schema, &pointer(&pointer(path, "properties"), name), false)?;
        }
    }
    if let Some(required) = value.get("required").and_then(Value::as_array) {
        for (index, name) in required.iter().enumerate() {
            if name.as_str().is_some_and(|name| {
                value
                    .get("properties")
                    .and_then(|properties| properties.get(name))
                    .is_none()
            }) {
                return Err((
                    pointer(&pointer(path, "required"), &index.to_string()),
                    "required must name a declared property",
                ));
            }
        }
    }
    if let Some(value) = value.get("const")
        && !primitive(value)
    {
        return fail("const", "const must be a JSON primitive");
    }
    if let Some(values) = value.get("enum").and_then(Value::as_array) {
        for (index, value) in values.iter().enumerate() {
            if !primitive(value) {
                return Err((
                    pointer(&pointer(path, "enum"), &index.to_string()),
                    "enum values must be JSON primitives",
                ));
            }
        }
    }
    if let Some(values) = value.get("oneOf").and_then(Value::as_array) {
        for (index, member) in values.iter().enumerate() {
            let member_path = pointer(&pointer(path, "oneOf"), &index.to_string());
            let Some(object) = member.as_object() else {
                return Err((member_path, "oneOf members must be constant objects"));
            };
            if !object.get("const").is_some_and(primitive)
                || object
                    .keys()
                    .any(|key| !matches!(key.as_str(), "const" | "title"))
            {
                return Err((member_path, "oneOf members allow only const and title"));
            }
        }
    }
    if let Some(values) = value.get("anyOf").and_then(Value::as_array) {
        for (index, schema) in values.iter().enumerate() {
            check(
                schema,
                &pointer(&pointer(path, "anyOf"), &index.to_string()),
                false,
            )?;
        }
    }
    if let Some(schema) = value.get("items") {
        check(schema, &pointer(path, "items"), false)?;
    }
    Ok(())
}

fn primitive(value: &Value) -> bool {
    !value.is_array() && !value.is_object()
}
