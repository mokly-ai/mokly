//! Workspace source layouts carried by module resolution requests.

use std::collections::BTreeMap;

use serde::de::{Error, Unexpected};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use ts_rs::TS;

/// Workspace source overrides from one configuration.
pub type SourcePackages = BTreeMap<String, SourcePackage>;

/// One package's build-to-source map or an explicit end to layout lookup.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(untagged)]
pub enum SourcePackage {
    /// Keep the original target at this point in the lookup order.
    #[serde(
        serialize_with = "serialize_false",
        deserialize_with = "deserialize_false"
    )]
    #[ts(type = "false")]
    Disabled,
    /// Map each build folder to its source folder relative to the package.
    Folders(BTreeMap<String, String>),
}

fn serialize_false<S: Serializer>(serializer: S) -> Result<S::Ok, S::Error> {
    serializer.serialize_bool(false)
}

fn deserialize_false<'de, D: Deserializer<'de>>(deserializer: D) -> Result<(), D::Error> {
    match bool::deserialize(deserializer)? {
        false => Ok(()),
        true => Err(D::Error::invalid_value(Unexpected::Bool(true), &"false")),
    }
}
