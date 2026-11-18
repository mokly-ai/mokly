//! Direct reason targets belong only to their matching reason kinds.

use serde::de::Error;
use serde::{Deserialize, Deserializer};

use crate::review::EntryChangeReason;

use super::raw::Record;

impl<'de> Deserialize<'de> for EntryChangeReason {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        let kind: String = raw.required("kind")?;
        if kind != "dependency" {
            raw.reject(&["path"])?;
        }
        if kind != "screen" {
            raw.reject(&["screenPath"])?;
        }
        match kind.as_str() {
            "added" => Ok(Self::Added),
            "removed" => Ok(Self::Removed),
            "metadata" => Ok(Self::Metadata),
            "material" => Ok(Self::Material),
            "implementation" => Ok(Self::Implementation),
            "inputs" => Ok(Self::Inputs),
            "structure" => Ok(Self::Structure),
            "dependency" => Ok(Self::Dependency {
                path: raw.required("path")?,
            }),
            "screen" => Ok(Self::Screen {
                screen_path: raw.required("screenPath")?,
            }),
            _ => Err(D::Error::unknown_variant(
                &kind,
                &[
                    "added",
                    "removed",
                    "metadata",
                    "material",
                    "implementation",
                    "inputs",
                    "structure",
                    "dependency",
                    "screen",
                ],
            )),
        }
    }
}
