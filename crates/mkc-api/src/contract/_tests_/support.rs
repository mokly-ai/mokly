//! In-memory schema validation with references collected through ToSchema.

#![allow(clippy::unwrap_used)]

use serde_json::{Value, json, to_value};
use utoipa::ToSchema;

pub(super) fn validator<T: ToSchema>() -> jsonschema::Validator {
    let mut schema = to_value(T::schema()).unwrap();
    let mut nested = Vec::new();
    T::schemas(&mut nested);
    let components: serde_json::Map<String, Value> = nested
        .into_iter()
        .map(|(name, schema)| (name, to_value(schema).unwrap()))
        .collect();
    schema["components"] = json!({"schemas": components});
    jsonschema::validator_for(&schema).unwrap()
}
