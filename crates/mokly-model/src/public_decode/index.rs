//! Decode navigation and historical preview variants without losing fields.

use serde::de::Error;
use serde::{Deserialize, Deserializer};

use crate::public_index::{CatalogueNode, RemovedPreview};

use super::raw::Record;

impl<'de> Deserialize<'de> for CatalogueNode {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        let kind: String = raw.required("kind")?;
        match kind.as_str() {
            "folder" => Ok(Self::Folder {
                path: raw.required("path")?,
                title: raw.required("title")?,
                index: raw.optional("index")?,
                hidden: raw.optional("hidden")?,
                order: raw.optional("order")?,
                children: raw.required("children")?,
            }),
            "entry" => {
                raw.reject(&["title", "index"])?;
                Ok(Self::Entry {
                    path: raw.required("path")?,
                    hidden: raw.optional("hidden")?,
                    order: raw.optional("order")?,
                    children: raw.optional("children")?,
                })
            }
            _ => Err(D::Error::unknown_variant(&kind, &["folder", "entry"])),
        }
    }
}

impl<'de> Deserialize<'de> for RemovedPreview {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        let kind: String = raw.required("kind")?;
        match kind.as_str() {
            "screen" => Ok(Self::Screen),
            "page" => Ok(Self::Page),
            "document" => Ok(Self::Document),
            _ => Err(D::Error::unknown_variant(
                &kind,
                &["screen", "page", "document"],
            )),
        }
    }
}
