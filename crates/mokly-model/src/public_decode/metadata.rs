//! Ready evidence fields belong only to ready comparison states.

use serde::{Deserialize, Deserializer};

use crate::public_metadata::{CatalogueChanges, ChangesStatus, ComparisonSelection};

use super::raw::Record;

impl<'de> Deserialize<'de> for CatalogueChanges {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        let status: ChangesStatus = raw.required("status")?;
        if status != ChangesStatus::Ready {
            raw.reject(&["kind", "included"])?;
        }
        Ok(match status {
            ChangesStatus::Preparing => Self::Preparing,
            ChangesStatus::Pending => Self::Pending,
            ChangesStatus::Unavailable => Self::Unavailable,
            ChangesStatus::Disabled => Self::Disabled,
            ChangesStatus::Ready => Self::Ready {
                kind: raw.required("kind")?,
                included: raw.required("included")?,
            },
        })
    }
}

impl<'de> Deserialize<'de> for ComparisonSelection {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        let status: ChangesStatus = raw.required("status")?;
        if status != ChangesStatus::Ready {
            raw.reject(&["kind", "eligible"])?;
        }
        Ok(match status {
            ChangesStatus::Preparing => Self::Preparing,
            ChangesStatus::Pending => Self::Pending,
            ChangesStatus::Unavailable => Self::Unavailable,
            ChangesStatus::Disabled => Self::Disabled,
            ChangesStatus::Ready => Self::Ready {
                kind: raw.required("kind")?,
                eligible: raw.required("eligible")?,
            },
        })
    }
}
