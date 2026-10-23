//! Schema inference over the entry props and every merged variant.

use std::collections::BTreeSet;

use crate::data::{DataValue, Props};
use crate::prop_schema::{JsonType, PropSchema, Types};

/// Infer a closed root object. Own keys are required; variant-only keys are optional.
pub fn infer(own: &Props, merged_variants: &[Props]) -> PropSchema {
    let values: Vec<_> = std::iter::once(own).chain(merged_variants).collect();
    let mut schema = objects(&values);
    schema.required = Some(own.keys().cloned().collect());
    schema
}

fn objects(values: &[&Props]) -> PropSchema {
    let keys: BTreeSet<_> = values.iter().flat_map(|value| value.keys()).collect();
    let required = keys
        .iter()
        .filter(|key| values.iter().all(|value| value.contains_key(**key)))
        .map(|key| (*key).clone())
        .collect();
    let properties = keys
        .into_iter()
        .map(|key| {
            let data: Vec<_> = values.iter().filter_map(|value| value.get(key)).collect();
            (key.clone(), infer_values(&data))
        })
        .collect();
    PropSchema {
        types: Some(Types::Single(JsonType::Object)),
        properties: Some(properties),
        required: Some(required),
        additional_properties: Some(false),
        ..PropSchema::default()
    }
}

fn infer_values(values: &[&DataValue]) -> PropSchema {
    let mut types = Vec::new();
    for (present, kind) in [
        (
            values.iter().any(|v| matches!(v, DataValue::String(_))),
            JsonType::String,
        ),
        (
            values.iter().any(|v| matches!(v, DataValue::Number(_))),
            JsonType::Number,
        ),
        (
            values.iter().any(|v| matches!(v, DataValue::Boolean(_))),
            JsonType::Boolean,
        ),
        (
            values.iter().any(|v| matches!(v, DataValue::Null)),
            JsonType::Null,
        ),
        (
            values.iter().any(|v| matches!(v, DataValue::Object(_))),
            JsonType::Object,
        ),
        (
            values.iter().any(|v| matches!(v, DataValue::Array(_))),
            JsonType::Array,
        ),
    ] {
        if present {
            types.push(kind);
        }
    }
    let mut schema = if let [kind] = types.as_slice() {
        PropSchema {
            types: Some(Types::Single(kind.clone())),
            ..PropSchema::default()
        }
    } else {
        PropSchema {
            types: Some(Types::Union(types)),
            ..PropSchema::default()
        }
    };
    let object_values: Vec<_> = values
        .iter()
        .filter_map(|value| {
            if let DataValue::Object(object) = value {
                Some(object)
            } else {
                None
            }
        })
        .collect();
    if !object_values.is_empty() {
        let object = objects(&object_values);
        schema.properties = object.properties;
        schema.required = object.required;
        schema.additional_properties = Some(false);
    }
    let items: Vec<_> = values
        .iter()
        .flat_map(|value| {
            if let DataValue::Array(items) = value {
                items.iter().collect::<Vec<_>>()
            } else {
                Vec::new()
            }
        })
        .collect();
    if !items.is_empty() {
        schema.items = Some(Box::new(infer_values(&items)));
    }
    schema
}

#[cfg(test)]
#[path = "_tests_/inference_tests.rs"]
mod inference_tests;
