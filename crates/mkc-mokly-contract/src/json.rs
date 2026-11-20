//! Strict typed JSON decoding and presence-sensitive optional fields.
//!
//! Structs decode from maps without buffering an untyped tree. Tagged Changes
//! objects use `object` and `string_enum` to retain map and literal-string
//! requirements inside serde's buffered payloads. Optional fields distinguish
//! absence from null, and each scalar keeps the deserializer's type check.
//! `json_guard` owns the budgets and the duplicate-key check before typed decoding.

use std::fmt;
use std::marker::PhantomData;
use std::result;

use serde::Deserialize;
use serde::de::value::{MapAccessDeserializer, StringDeserializer};
use serde::de::{Deserializer, MapAccess, Visitor};
use serde_json::Value;

use crate::error::{Rejection, Result, invalid};
use crate::json_guard;
use crate::json_objects::deserializer::ObjectDeserializer;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawVersion {
    #[serde(default, deserialize_with = "optional")]
    schema_version: Option<Value>,
}

/// A document's schema version, classified before its body is typed.
pub(crate) enum SchemaVersion {
    /// The root has no `schemaVersion`.
    Missing,
    /// The version equals the expected integer.
    Supported,
    /// Any other present value; integers are kept for diagnostics.
    Unsupported(Option<u64>),
}

/// Probe a versioned root object, accepting equivalent integer spellings only.
pub(crate) fn schema_version(bytes: &[u8], expected: u64) -> Result<SchemaVersion> {
    Ok(match decode::<RawVersion>(bytes)?.schema_version {
        None => SchemaVersion::Missing,
        Some(value) => match integer(&value) {
            Some(version) if version == expected => SchemaVersion::Supported,
            version => SchemaVersion::Unsupported(version),
        },
    })
}

fn integer(value: &Value) -> Option<u64> {
    value.as_u64().or_else(|| {
        value
            .as_f64()
            .filter(|number| {
                number.fract() == 0.0 && (0.0..=9_007_199_254_740_991.0).contains(number)
            })
            .map(|number| number as u64)
    })
}

pub(crate) fn decode<'de, T: Deserialize<'de>>(bytes: &'de [u8]) -> Result<T> {
    json_guard::check(bytes)?;
    let mut typed = serde_json::Deserializer::from_slice(bytes);
    typed.disable_recursion_limit();
    match T::deserialize(ObjectDeserializer(&mut typed)) {
        Ok(value) => Ok(value),
        Err(_) => Err(invalid(Rejection::Json)),
    }
}

pub(crate) fn nullable<'de, D: Deserializer<'de>, T: Deserialize<'de>>(
    deserializer: D,
) -> result::Result<Option<T>, D::Error> {
    Option::<T>::deserialize(deserializer)
}

pub(crate) fn optional<'de, D: Deserializer<'de>, T: Deserialize<'de>>(
    deserializer: D,
) -> result::Result<Option<T>, D::Error> {
    Ok(Some(T::deserialize(deserializer)?))
}

#[cfg(test)]
#[path = "_tests_/json_numbers_tests.rs"]
mod json_numbers_tests;

#[cfg(test)]
#[path = "_tests_/json_bounds_tests.rs"]
mod json_bounds_tests;

#[cfg(test)]
#[path = "_tests_/json_objects_tests.rs"]
mod json_objects_tests;

/// Force maps inside internally tagged enum payloads, which serde buffers first.
pub(crate) fn object<'de, D: Deserializer<'de>, T: Deserialize<'de>>(
    deserializer: D,
) -> result::Result<T, D::Error> {
    deserializer.deserialize_map(ObjectValue(PhantomData))
}

/// Decode a buffered tagged field through map access instead of positional struct syntax.
struct ObjectValue<T>(PhantomData<T>);
impl<'de, T: Deserialize<'de>> Visitor<'de> for ObjectValue<T> {
    type Value = T;
    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON object")
    }
    fn visit_map<A: MapAccess<'de>>(self, access: A) -> result::Result<T, A::Error> {
        T::deserialize(ObjectDeserializer(MapAccessDeserializer::new(access)))
    }
}

/// Require a literal string for enums inside serde-buffered tagged payloads.
pub(crate) fn string_enum<'de, D: Deserializer<'de>, T: Deserialize<'de>>(
    deserializer: D,
) -> result::Result<T, D::Error> {
    T::deserialize(StringDeserializer::<D::Error>::new(String::deserialize(
        deserializer,
    )?))
}
