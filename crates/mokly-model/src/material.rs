//! Stable material, instance, and receiving-slot digest preimages.

use sha2::{Digest, Sha256};

use crate::canonical::compare_utf16;
use crate::data::Props;
use crate::usage::ComponentInputOwner;
use crate::wire_props;

/// Hash UTF-8 bytes to a lowercase SHA-256 digest.
pub fn digest(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Hash normalized props under the Review material encoding.
pub fn props_key(props: &Props) -> String {
    let mut fields: Vec<_> = wire_props::encode(props).into_iter().collect();
    fields.sort_by(|a, b| compare_utf16(&a.0, &b.0));
    let bytes = serde_json::to_vec(&("object", fields))
        .expect("tagged props contain only JSON data, string keys, and ordered field pairs");
    digest(&bytes)
}

/// Hash an instance's input scope and validated local id.
pub fn instance_key(owner: &ComponentInputOwner, slot: Option<&str>, id: &str) -> String {
    let (kind, key) = match owner {
        ComponentInputOwner::Entry => ("entry", None),
        ComponentInputOwner::Instance { instance_key } => ("instance", Some(instance_key.as_str())),
    };
    let bytes = serde_json::to_vec(&("mokly-instance-v1", kind, key, slot, id))
        .expect("instance key preimages contain only strings and optional strings");
    digest(&bytes)
}

/// Hash a receiving instance and declared slot name.
pub fn slot_key(instance: &str, name: &str) -> String {
    let bytes = serde_json::to_vec(&("mokly-slot-v1", instance, name))
        .expect("slot key preimages contain only strings");
    digest(&bytes)
}

/// Hash a historical record identity without metadata, time, or transient generations.
pub fn historical_snapshot_key(catalogue: &str, commit: &str, kind: &str, path: &str) -> String {
    let bytes = serde_json::to_vec(&(
        "mokly-historical-snapshot-v3",
        catalogue,
        "base",
        commit,
        kind,
        path,
    ))
    .expect("historical snapshot key preimages contain only strings");
    digest(&bytes)
}

/// Hash the stable origin-scoped configuration identity.
pub fn catalogue_key(config_path: &str) -> String {
    let bytes = serde_json::to_vec(&("mokly-catalogue-v1", config_path))
        .expect("catalogue key preimages contain only strings");
    digest(&bytes)
}

#[cfg(test)]
#[path = "_tests_/material_tests.rs"]
mod material_tests;
