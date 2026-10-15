//! Stable material, instance, and receiving-slot digest preimages.

use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::canonical::compare_utf16;
use crate::data::Props;
use crate::error::{InternalError, ModelError, Result};
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
pub fn props_key(props: &Props) -> Result<String> {
    let mut fields: Vec<_> = wire_props::encode(props).into_iter().collect();
    fields.sort_by(|a, b| compare_utf16(&a.0, &b.0));
    hash_json(&("object", fields))
}

/// Hash an instance's input scope and validated local id.
pub fn instance_key(owner: &ComponentInputOwner, slot: Option<&str>, id: &str) -> Result<String> {
    let (kind, key) = match owner {
        ComponentInputOwner::Entry => ("entry", None),
        ComponentInputOwner::Instance { instance_key } => ("instance", Some(instance_key.as_str())),
    };
    hash_json(&("mokly-instance-v1", kind, key, slot, id))
}

/// Hash a receiving instance and declared slot name.
pub fn slot_key(instance: &str, name: &str) -> Result<String> {
    hash_json(&("mokly-slot-v1", instance, name))
}

fn hash_json(value: &impl Serialize) -> Result<String> {
    match serde_json::to_vec(value) {
        Ok(bytes) => Ok(digest(&bytes)),
        Err(source) => Err(ModelError::Internal(InternalError::Json { source })),
    }
}
