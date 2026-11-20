//! Shared response validation for in-process, reqwest and Python endpoint harnesses.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::BTreeMap;
use std::sync::{Arc, LazyLock, Mutex};

use jsonschema::Validator;
use serde_json::{Value, json};
use utoipa::OpenApi;

use crate::contract::document::ApiDoc;

static DOCUMENT: LazyLock<Value> =
    LazyLock::new(|| serde_json::to_value(ApiDoc::openapi()).unwrap());
static VALIDATORS: Mutex<BTreeMap<String, Arc<Validator>>> = Mutex::new(BTreeMap::new());

pub(crate) fn document() -> &'static Value {
    &DOCUMENT
}

pub(crate) fn validate(method: &str, path: &str, status: u16, body: &[u8]) {
    if body.is_empty() {
        return;
    }
    let value: Value = serde_json::from_slice(body).expect("API response must be JSON");
    let path = path.split('?').next().unwrap();
    let matched = document()["paths"]
        .as_object()
        .unwrap()
        .iter()
        .filter(|(template, _)| matches_path(template, path))
        .max_by_key(|(template, _)| {
            template
                .split('/')
                .map(|part| !part.starts_with('{'))
                .collect::<Vec<_>>()
        });
    let operation = matched.and_then(|(_, item)| item.get(method.to_ascii_lowercase()));
    let (id, pointer) = if let Some(operation) = operation {
        let id = operation["operationId"].as_str().unwrap();
        let responses = &operation["responses"];
        let exact = status.to_string();
        let range = format!("{}XX", status / 100);
        let key = if responses.get(&exact).is_some() {
            exact
        } else {
            range
        };
        assert!(
            responses.get(&key).is_some(),
            "{id}: undocumented status {status}"
        );
        let template = matched.unwrap().0.replace('~', "~0").replace('/', "~1");
        let pointer = format!(
            "/paths/{template}/{}/responses/{key}",
            method.to_ascii_lowercase()
        );
        let (_, pointer) = resolve_reference(&responses[&key], &pointer);
        (id, format!("{pointer}/content/application~1json/schema"))
    } else {
        assert!(
            matches!(
                (status, value["error"]["reason"].as_str()),
                (404, Some("not-found")) | (400, Some("method-not-allowed"))
            ),
            "unexpected router fallback: {method} {path}: {status}"
        );
        ("routerFallback", "/components/schemas/Error".into())
    };
    let validator = validator_at(&pointer);
    let errors: Vec<_> = validator
        .iter_errors(&value)
        .map(|error| error.to_string())
        .collect();
    assert!(errors.is_empty(), "{id} {status}: {}", errors.join("; "));
    let record = format!("CONTRACT_RESPONSE {id} {status}");
    eprintln!("{record}");
}

/// Resolve local response references before selecting a body schema.
pub(crate) fn resolve_reference<'a>(
    mut value: &'a Value,
    mut pointer: &'a str,
) -> (&'a Value, &'a str) {
    while let Some(reference) = value.get("$ref") {
        pointer = reference.as_str().unwrap().strip_prefix('#').unwrap();
        value = document().pointer(pointer).unwrap();
    }
    (value, pointer)
}

pub(crate) fn validator_at(pointer: &str) -> Arc<Validator> {
    let mut validators = VALIDATORS.lock().unwrap();
    validators
        .entry(pointer.into())
        .or_insert_with(|| {
            assert!(
                document().pointer(pointer).is_some(),
                "missing schema: {pointer}"
            );
            let schema = json!({
                "allOf": [document().pointer(pointer).unwrap()],
                "components": document()["components"],
            });
            Arc::new(jsonschema::validator_for(&schema).unwrap())
        })
        .clone()
}

fn matches_path(template: &str, path: &str) -> bool {
    let template: Vec<_> = template.split('/').collect();
    let path: Vec<_> = path.split('/').collect();
    template.len() == path.len()
        && template.iter().zip(path).all(|(expected, actual)| {
            *expected == actual || (expected.starts_with('{') && !actual.is_empty())
        })
}
