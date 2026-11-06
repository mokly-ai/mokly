//! Shared author-input cases exercise the public Rust validator and path grammar.

use serde::Deserialize;
use serde_json::{Value, json};

use crate::diagnostic::{AuthoringKind, Context};
use crate::error::ModelError;
use crate::paths;
use crate::validation::PropValidator;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Cases {
    values: Vec<PropsCase>,
    reserved_properties: Vec<String>,
    limits: Vec<LimitCase>,
}

#[derive(Deserialize)]
struct PropsCase {
    name: String,
    schema: Value,
    value: Value,
    valid: bool,
    pointer: String,
}

#[derive(Deserialize)]
struct LimitCase {
    name: String,
    kind: Shape,
    size: usize,
    probe: bool,
    valid: bool,
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Shape {
    Wide,
    Nested,
}

#[derive(Deserialize)]
struct Navigation {
    paths: Vec<PathCase>,
}

#[derive(Deserialize)]
struct PathCase {
    value: String,
    valid: bool,
}

fn cases() -> Cases {
    serde_json::from_str(include_str!(
        "../../../../packages/viewer/tests/fixtures/author-checks/props.json"
    ))
    .unwrap()
}

fn context() -> Context {
    Context {
        entry: "shared.mockup.tsx#Component".into(),
        variant: None,
        kind: AuthoringKind::JavaScript,
    }
}

#[test]
fn shared_props_keep_exact_values_and_rejection_paths() {
    let context = context();
    for fixture in cases().values {
        let validator = PropValidator::compile(&fixture.schema, &context).unwrap();
        let original = fixture.value.clone();
        let pointer = match validator.validate(&fixture.value, &context) {
            Ok(()) => None,
            Err(ModelError::Props(diagnostic)) => Some(diagnostic.path),
            Err(error) => panic!("{}: {error}", fixture.name),
        };
        let expected = (!fixture.valid).then_some(fixture.pointer);
        assert_eq!(pointer, expected, "{}", fixture.name);
        assert_eq!(fixture.value, original, "{}", fixture.name);
    }
}

#[test]
fn shared_reserved_schema_names_remain_forbidden_in_props() {
    let context = context();
    for key in cases().reserved_properties {
        let schema = json!({"type":"object","additionalProperties":false,
            "properties":{&key:{"type":"null"}}});
        let validator = PropValidator::compile(&schema, &context).unwrap();
        validator.validate(&json!({}), &context).unwrap();
        let diagnostic = match validator.validate(&json!({&key:null}), &context) {
            Ok(()) => None,
            Err(ModelError::Props(diagnostic)) => Some((diagnostic.path, diagnostic.message)),
            Err(error) => panic!("unexpected error: {error}"),
        };
        assert_eq!(
            diagnostic,
            Some((format!("/{key}"), "reserved property name".into()))
        );
    }
}

#[test]
fn shared_limits_count_data_instead_of_union_probe_work() {
    let context = context();
    for fixture in cases().limits {
        let property = if fixture.probe {
            json!({"anyOf":[{"type":"string"},{"type":"array","items":{"type":"null"}}]})
        } else {
            json!({"type":"array"})
        };
        let schema = json!({"type":"object","additionalProperties":false,
            "properties":{"value":property},"required":["value"]});
        let validator = PropValidator::compile(&schema, &context).unwrap();
        let value = match fixture.kind {
            Shape::Wide => json!(vec![Value::Null; fixture.size]),
            Shape::Nested => (0..fixture.size).fold(Value::Null, |value, _| json!([value])),
        };
        let error = match validator.validate(&json!({"value":value}), &context) {
            Ok(()) => None,
            Err(ModelError::Props(diagnostic)) => Some((diagnostic.message, diagnostic.path)),
            Err(error) => panic!("{}: {error}", fixture.name),
        };
        let expected = (!fixture.valid).then(|| match fixture.kind {
            Shape::Wide => ("exceeds 10000 visited nodes".into(), "/value/9998".into()),
            Shape::Nested => (
                "exceeds 64 nesting levels".into(),
                format!("/value{}", "/0".repeat(64)),
            ),
        });
        assert_eq!(error, expected, "{}", fixture.name);
    }
}

#[test]
fn shared_catalogue_paths_keep_portable_entry_identities() {
    let cases: Navigation = serde_json::from_str(include_str!(
        "../../../../packages/viewer/tests/fixtures/author-checks/navigation.json"
    ))
    .unwrap();
    for fixture in cases.paths {
        assert_eq!(
            paths::is_entry_path(&fixture.value),
            fixture.valid,
            "{}",
            fixture.value
        );
    }
}
