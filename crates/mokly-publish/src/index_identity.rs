//! Retain only the catalogue index's comparison identity while checking all JSON keys in a stream.

use std::collections::BTreeSet;
use std::fmt;

use mokly_model::versions::CATALOGUE_INDEX;
use serde::de::{self, Deserialize, Deserializer, MapAccess, Visitor};

use crate::error::{Error, Result};
use crate::json_skip::Skip;

/// The only index fields that the byte-carrying upload exchange checks.
pub(crate) struct IndexIdentity {
    /// Effective base ref, present when Changes is configured.
    pub base: Option<String>,
    /// Full pinned merge-base object id, present exactly while Changes is ready.
    pub base_commit: Option<String>,
}

impl IndexIdentity {
    /// Validate the entire JSON stream and retain only the comparison identity.
    pub(crate) fn parse(bytes: &[u8]) -> Result<Self> {
        match serde_json::from_slice(bytes) {
            Ok(identity) => Ok(identity),
            Err(_) => Err(Error::InvalidBundle),
        }
    }
}

impl<'de> Deserialize<'de> for IndexIdentity {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        deserializer.deserialize_map(IdentityVisitor)
    }
}

struct IdentityVisitor;

impl<'de> Visitor<'de> for IdentityVisitor {
    type Value = IndexIdentity;
    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a catalogue index object with its comparison identity")
    }
    fn visit_map<A: MapAccess<'de>>(
        self,
        mut object: A,
    ) -> std::result::Result<IndexIdentity, A::Error> {
        let mut keys = BTreeSet::new();
        let mut version = None;
        let mut base = None;
        let mut base_commit = None;
        while let Some(key) = object.next_key::<String>()? {
            if !keys.insert(key.clone()) {
                return Err(de::Error::custom("duplicate JSON key"));
            }
            match key.as_str() {
                "schemaVersion" => version = Some(object.next_value::<f64>()?),
                "base" => base = Some(object.next_value::<String>()?),
                "baseCommit" => base_commit = Some(object.next_value::<String>()?),
                _ => {
                    object.next_value::<Skip>()?;
                }
            }
        }
        if version != Some(f64::from(CATALOGUE_INDEX)) {
            return Err(de::Error::custom("unsupported catalogue index version"));
        }
        Ok(IndexIdentity { base, base_commit })
    }
}
