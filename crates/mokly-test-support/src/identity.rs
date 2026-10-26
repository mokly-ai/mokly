//! Recompute the comparison generation and the deployment identity of an output.

use std::collections::BTreeMap;

use serde_json::{Map, Value};

use crate::inventory::{MARKER, digest};

/// The placeholder that replaces an identity inside the document it names.
fn zero() -> Value {
    Value::String("0".repeat(64))
}

/// Pretty JSON with sorted object keys and a final newline.
pub fn canonical(value: &Value) -> String {
    format!(
        "{}\n",
        serde_json::to_string_pretty(&sorted(value)).unwrap()
    )
}

fn sorted(value: &Value) -> Value {
    match value {
        Value::Array(items) => Value::Array(items.iter().map(sorted).collect()),
        Value::Object(object) => {
            let mut keys: Vec<_> = object.keys().collect();
            keys.sort_unstable();
            let map: Map<_, _> = keys
                .into_iter()
                .map(|key| (key.clone(), sorted(&object[key])))
                .collect();
            Value::Object(map)
        }
        other => other.clone(),
    }
}

fn identity(mut pairs: Vec<(String, String)>) -> String {
    pairs.sort();
    let value = Value::Array(
        pairs
            .into_iter()
            .map(|(name, hash)| Value::Array(vec![Value::String(name), Value::String(hash)]))
            .collect(),
    );
    digest(canonical(&value).as_bytes())
}

fn without(bytes: &[u8], field: &str) -> String {
    let mut document: Value = serde_json::from_slice(bytes).unwrap();
    document[field] = zero();
    digest(canonical(&document).as_bytes())
}

/// Check that `inventory` hashes to `deployment_id`, and that its comparison
/// files hash to the generation in `comparison_url`.
pub fn check(inventory: &BTreeMap<String, Vec<u8>>, comparison_url: &str, deployment_id: &str) {
    let prefix = comparison_url
        .strip_suffix("review.json")
        .expect("a comparison URL ends with review.json");
    let generation = prefix.trim_end_matches('/').rsplit('/').next().unwrap();
    let mut comparison = Vec::new();
    let mut deployment = Vec::new();
    for (name, bytes) in inventory {
        let file = name.replace('\\', "/");
        if let Some(relative) = file.strip_prefix(prefix) {
            let hash = if relative.starts_with("entries/") {
                let detail: Value = serde_json::from_slice(bytes).unwrap();
                assert_eq!(detail["generation"], generation);
                without(bytes, "generation")
            } else {
                digest(bytes)
            };
            comparison.push((relative.to_owned(), hash));
        }
        if file == MARKER || file == "mokly-upload.json" {
            continue;
        }
        let hash = if file == "mokly-viewer/index.json" || file.starts_with("mokly-viewer/entries/")
        {
            without(bytes, "deploymentId")
        } else {
            digest(bytes)
        };
        deployment.push((file, hash));
    }
    assert!(comparison.len() > 3);
    assert_eq!(identity(comparison.clone()), generation);
    assert_eq!(identity(deployment), deployment_id);
    let changed = comparison
        .into_iter()
        .map(|(name, hash)| {
            let hash = if name == "review.json" {
                "0".repeat(64)
            } else {
                hash
            };
            (name, hash)
        })
        .collect();
    assert_ne!(identity(changed), generation);
}
