//! Strict JSON decoding at the external protocol boundary.

use std::fmt;

use serde::de::{self, Deserialize, Deserializer, MapAccess, SeqAccess, Visitor};
use serde_json::{Map, Number, Value};

use crate::error::{Error, Result};

/// Decode JSON while rejecting duplicate keys in every nested object.
pub(crate) fn unique(bytes: &[u8]) -> Result<Value> {
    match serde_json::from_slice::<Unique>(bytes) {
        Ok(value) => Ok(value.0),
        Err(_) => Err(Error::InvalidBundle),
    }
}

struct Unique(Value);

impl<'de> Deserialize<'de> for Unique {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        deserializer.deserialize_any(UniqueVisitor)
    }
}

struct UniqueVisitor;

impl<'de> Visitor<'de> for UniqueVisitor {
    type Value = Unique;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("JSON with unique object keys")
    }

    fn visit_bool<E: de::Error>(self, value: bool) -> std::result::Result<Unique, E> {
        Ok(Unique(Value::Bool(value)))
    }

    fn visit_i64<E: de::Error>(self, value: i64) -> std::result::Result<Unique, E> {
        Ok(Unique(Value::Number(value.into())))
    }

    fn visit_u64<E: de::Error>(self, value: u64) -> std::result::Result<Unique, E> {
        Ok(Unique(Value::Number(value.into())))
    }

    fn visit_f64<E: de::Error>(self, value: f64) -> std::result::Result<Unique, E> {
        match Number::from_f64(value) {
            Some(number) => Ok(Unique(Value::Number(number))),
            None => Err(E::custom("non-finite JSON number")),
        }
    }

    fn visit_str<E: de::Error>(self, value: &str) -> std::result::Result<Unique, E> {
        Ok(Unique(Value::String(value.to_owned())))
    }

    fn visit_string<E: de::Error>(self, value: String) -> std::result::Result<Unique, E> {
        Ok(Unique(Value::String(value)))
    }

    fn visit_unit<E: de::Error>(self) -> std::result::Result<Unique, E> {
        Ok(Unique(Value::Null))
    }

    fn visit_none<E: de::Error>(self) -> std::result::Result<Unique, E> {
        Ok(Unique(Value::Null))
    }

    fn visit_seq<A: SeqAccess<'de>>(
        self,
        mut sequence: A,
    ) -> std::result::Result<Unique, A::Error> {
        let mut items = Vec::new();
        while let Some(item) = sequence.next_element::<Unique>()? {
            items.push(item.0);
        }
        Ok(Unique(Value::Array(items)))
    }

    fn visit_map<A: MapAccess<'de>>(self, mut object: A) -> std::result::Result<Unique, A::Error> {
        let mut fields = Map::new();
        while let Some(key) = object.next_key::<String>()? {
            if fields.contains_key(&key) {
                return Err(de::Error::custom("duplicate JSON key"));
            }
            fields.insert(key, object.next_value::<Unique>()?.0);
        }
        Ok(Unique(Value::Object(fields)))
    }
}
