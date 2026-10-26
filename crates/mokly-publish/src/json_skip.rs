//! Streaming duplicate-key checks for index fields that are not retained.

use std::collections::BTreeSet;
use std::fmt;

use serde::de::{self, Deserialize, Deserializer, MapAccess, SeqAccess, Visitor};

pub(crate) struct Skip;

impl<'de> Deserialize<'de> for Skip {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        deserializer.deserialize_any(SkipVisitor)
    }
}

struct SkipVisitor;

impl<'de> Visitor<'de> for SkipVisitor {
    type Value = Skip;
    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("JSON with unique object keys")
    }
    fn visit_bool<E: de::Error>(self, _: bool) -> std::result::Result<Skip, E> {
        Ok(Skip)
    }
    fn visit_i64<E: de::Error>(self, _: i64) -> std::result::Result<Skip, E> {
        Ok(Skip)
    }
    fn visit_u64<E: de::Error>(self, _: u64) -> std::result::Result<Skip, E> {
        Ok(Skip)
    }
    fn visit_f64<E: de::Error>(self, _: f64) -> std::result::Result<Skip, E> {
        Ok(Skip)
    }
    fn visit_str<E: de::Error>(self, _: &str) -> std::result::Result<Skip, E> {
        Ok(Skip)
    }
    fn visit_unit<E: de::Error>(self) -> std::result::Result<Skip, E> {
        Ok(Skip)
    }
    fn visit_seq<A: SeqAccess<'de>>(self, mut values: A) -> std::result::Result<Skip, A::Error> {
        while values.next_element::<Skip>()?.is_some() {}
        Ok(Skip)
    }
    fn visit_map<A: MapAccess<'de>>(self, mut object: A) -> std::result::Result<Skip, A::Error> {
        let mut keys = BTreeSet::new();
        while let Some(key) = object.next_key::<String>()? {
            if !keys.insert(key) {
                return Err(de::Error::custom("duplicate JSON key"));
            }
            object.next_value::<Skip>()?;
        }
        Ok(Skip)
    }
}
