//! Authored workspace source overrides and their JSON forms.

use std::collections::BTreeMap;

use serde::de::value::MapAccessDeserializer;
use serde::de::{self, MapAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// Source overrides for the workspace packages of one configuration.
pub type SourcePackages = BTreeMap<String, SourcePackage>;

/// One package's replacement layout or an explicit end to layout lookup.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SourcePackage {
    /// Keep the original target at this point in the lookup order.
    Disabled,
    /// Map each build folder to its source folder relative to the package.
    Folders(BTreeMap<String, String>),
}

impl Serialize for SourcePackage {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Disabled => serializer.serialize_bool(false),
            Self::Folders(folders) => folders.serialize(serializer),
        }
    }
}

impl<'de> Deserialize<'de> for SourcePackage {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct Entry;

        impl<'de> Visitor<'de> for Entry {
            type Value = SourcePackage;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("false or a build-to-source folder map")
            }

            fn visit_bool<E: de::Error>(self, value: bool) -> Result<Self::Value, E> {
                if value {
                    return Err(E::invalid_value(de::Unexpected::Bool(value), &self));
                }
                Ok(SourcePackage::Disabled)
            }

            fn visit_map<M: MapAccess<'de>>(self, map: M) -> Result<Self::Value, M::Error> {
                BTreeMap::deserialize(MapAccessDeserializer::new(map)).map(SourcePackage::Folders)
            }
        }

        deserializer.deserialize_any(Entry)
    }
}
