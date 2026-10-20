//! Preserve authored control order before maps become canonical lookup tables.

use std::collections::BTreeSet;

use serde_json::Value;

/// Explicit controls win, then schema properties, then first-seen inferred props.
fn from_keys(
    controls: Option<Vec<String>>,
    schema: Option<&Value>,
    props: Vec<String>,
) -> Vec<String> {
    let mut order = controls.unwrap_or_else(|| {
        schema
            .and_then(|schema| schema.get("properties"))
            .and_then(Value::as_object)
            .map(|properties| properties.keys().cloned().collect())
            .unwrap_or(props)
    });
    let mut seen = BTreeSet::new();
    order.retain(|key| seen.insert(key.clone()));
    order
}

pub(crate) fn from_value(value: &Value) -> Vec<String> {
    let controls = value
        .get("controls")
        .and_then(Value::as_object)
        .map(|controls| controls.keys().cloned().collect());
    let variants = value
        .get("variants")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|variant| variant.get("props"));
    let props = value
        .get("props")
        .into_iter()
        .chain(variants)
        .filter_map(Value::as_object)
        .flat_map(|props| props.keys().cloned())
        .collect();
    from_keys(controls, value.get("propSchema"), props)
}
