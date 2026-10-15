//! JSON numbers follow JavaScript numeric equality and safe-integer limits.

use serde::de;
use serde::{Deserialize, Deserializer};
use serde_json::Number;

pub(crate) fn version<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<u32, D::Error> {
    let number = Number::deserialize(deserializer)?;
    match number.as_f64() {
        Some(number) if number.fract() == 0.0 && (0.0..=u32::MAX as f64).contains(&number) => {
            Ok(number as u32)
        }
        _ => Err(de::Error::custom("invalid version number")),
    }
}

pub(crate) fn pull_request<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<Option<u64>, D::Error> {
    let Some(number) = Option::<Number>::deserialize(deserializer)? else {
        return Ok(None);
    };
    match number.as_f64() {
        Some(number)
            if number.fract() == 0.0 && (1.0..=9_007_199_254_740_991.0).contains(&number) =>
        {
            Ok(Some(number as u64))
        }
        _ => Err(de::Error::custom("invalid pull request number")),
    }
}
