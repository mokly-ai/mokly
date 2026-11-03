//! Usage readiness, input ownership, and region targets decode from raw records.

use serde::de::Error;
use serde::{Deserialize, Deserializer};

use crate::usage::{CatalogueUsage, ComponentInputOwner, ComponentRangeTarget};

use super::raw::Record;

impl<'de> Deserialize<'de> for CatalogueUsage {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        let status: String = raw.required("status")?;
        if status != "ready" {
            raw.reject(&["instances", "slots", "ranges"])?;
        }
        match status.as_str() {
            "pending" => Ok(Self::Pending),
            "unavailable" => Ok(Self::Unavailable),
            "ready" => Ok(Self::Ready {
                instances: raw.required("instances")?,
                slots: raw.required("slots")?,
                ranges: raw.required("ranges")?,
            }),
            _ => Err(D::Error::unknown_variant(
                &status,
                &["pending", "unavailable", "ready"],
            )),
        }
    }
}

impl<'de> Deserialize<'de> for ComponentInputOwner {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        let kind: String = raw.required("kind")?;
        match kind.as_str() {
            "entry" => {
                raw.reject(&["instanceKey"])?;
                Ok(Self::Entry)
            }
            "instance" => Ok(Self::Instance {
                instance_key: raw.required("instanceKey")?,
            }),
            _ => Err(D::Error::unknown_variant(&kind, &["entry", "instance"])),
        }
    }
}

impl<'de> Deserialize<'de> for ComponentRangeTarget {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        let kind: String = raw.required("kind")?;
        match kind.as_str() {
            "instance" => {
                raw.reject(&["slotKey"])?;
                Ok(Self::Instance {
                    instance_key: raw.required("instanceKey")?,
                })
            }
            "slot" => {
                raw.reject(&["instanceKey"])?;
                Ok(Self::Slot {
                    slot_key: raw.required("slotKey")?,
                })
            }
            "root" => {
                raw.reject(&["instanceKey", "slotKey"])?;
                Ok(Self::Root)
            }
            _ => Err(D::Error::unknown_variant(
                &kind,
                &["instance", "slot", "root"],
            )),
        }
    }
}
