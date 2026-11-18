//! Public evidence owners retain their own field placement rules.

use serde::de::Error;
use serde::{Deserialize, Deserializer};

use crate::evidence::EvidenceOwner;

use super::raw::Record;

impl<'de> Deserialize<'de> for EvidenceOwner {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        let kind: String = raw.required("kind")?;
        match kind.as_str() {
            "entry" => {
                raw.reject(&["path"])?;
                Ok(Self::Entry)
            }
            "component" => Ok(Self::Component {
                path: raw.required("path")?,
            }),
            _ => Err(D::Error::unknown_variant(&kind, &["entry", "component"])),
        }
    }
}
