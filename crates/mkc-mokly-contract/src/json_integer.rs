//! Integer JSON values accept equivalent decimal and exponent spellings.

use std::fmt;

use serde::de::{Error, Visitor};
use serde::{Deserialize, Deserializer};

pub(crate) fn integer<'de, D: Deserializer<'de>>(deserializer: D) -> Result<u64, D::Error> {
    Ok(Unsigned::deserialize(deserializer)?.0)
}

pub(crate) fn nullable_integer<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<u64>, D::Error> {
    Ok(Option::<Unsigned>::deserialize(deserializer)?.map(|value| value.0))
}

struct Unsigned(u64);

impl<'de> Deserialize<'de> for Unsigned {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(IntegerVisitor)
    }
}

struct IntegerVisitor;

impl Visitor<'_> for IntegerVisitor {
    type Value = Unsigned;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a nonnegative safe integer")
    }

    fn visit_u64<E: Error>(self, value: u64) -> Result<Unsigned, E> {
        if value <= 9_007_199_254_740_991 {
            Ok(Unsigned(value))
        } else {
            Err(E::custom("integer exceeds JavaScript safe range"))
        }
    }

    fn visit_i64<E: Error>(self, value: i64) -> Result<Unsigned, E> {
        if value >= 0 {
            self.visit_u64(value as u64)
        } else {
            Err(E::custom("negative integer"))
        }
    }

    fn visit_f64<E: Error>(self, value: f64) -> Result<Unsigned, E> {
        if (0.0..=9_007_199_254_740_991.0).contains(&value) && value.fract() == 0.0 {
            Ok(Unsigned(value as u64))
        } else {
            Err(E::custom("fractional or out of range integer"))
        }
    }
}
