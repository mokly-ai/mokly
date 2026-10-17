//! Retain only pinned review identity while checking all JSON keys in a stream.

use std::collections::BTreeSet;
use std::fmt;

use mokly_model::versions::REVIEW_RESULT;
use serde::de::{self, Deserialize, Deserializer, MapAccess, Visitor};

use crate::error::{Error, Result};
use crate::review_json::Skip;

/// The only review fields needed by the byte-carrying upload exchange.
pub(crate) struct ReviewIdentity {
    /// Full pinned merge-base object id.
    pub base_commit: String,
}

impl ReviewIdentity {
    /// Validate the entire JSON stream and retain only the identity.
    pub(crate) fn parse(bytes: &[u8]) -> Result<Self> {
        match serde_json::from_slice(bytes) {
            Ok(identity) => Ok(identity),
            Err(_) => Err(Error::InvalidBundle),
        }
    }
}

impl<'de> Deserialize<'de> for ReviewIdentity {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        deserializer.deserialize_map(IdentityVisitor)
    }
}

struct IdentityVisitor;

impl<'de> Visitor<'de> for IdentityVisitor {
    type Value = ReviewIdentity;
    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a review object with pinned base identity")
    }
    fn visit_map<A: MapAccess<'de>>(
        self,
        mut object: A,
    ) -> std::result::Result<ReviewIdentity, A::Error> {
        let mut keys = BTreeSet::new();
        let mut version = None;
        let mut base_commit = None;
        while let Some(key) = object.next_key::<String>()? {
            if !keys.insert(key.clone()) {
                return Err(de::Error::custom("duplicate JSON key"));
            }
            match key.as_str() {
                "schemaVersion" => version = Some(object.next_value::<f64>()?),
                "baseCommit" => base_commit = Some(object.next_value::<String>()?),
                _ => {
                    object.next_value::<Skip>()?;
                }
            }
        }
        if version != Some(f64::from(REVIEW_RESULT)) {
            return Err(de::Error::custom("unsupported review version"));
        }
        Ok(ReviewIdentity {
            base_commit: base_commit.ok_or_else(|| de::Error::missing_field("baseCommit"))?,
        })
    }
}
