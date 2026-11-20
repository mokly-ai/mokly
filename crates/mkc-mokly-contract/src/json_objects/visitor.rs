//! Preserve serde values and propagate object rules into nested collections.

use std::fmt;
use std::result;

use serde::de::{self, Deserializer, EnumAccess, IntoDeserializer, MapAccess, SeqAccess, Visitor};

use super::access::{ObjectEnum, ObjectMap, ObjectSequence};
use super::deserializer::ObjectDeserializer;

/// Forward scalar values and recursively adapt maps, sequences and nested payloads.
pub(crate) struct ObjectVisitor<V>(pub(crate) V);

impl<'de, V: Visitor<'de>> Visitor<'de> for ObjectVisitor<V> {
    type Value = V::Value;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.expecting(formatter)
    }

    fn visit_bool<E: de::Error>(self, value: bool) -> result::Result<V::Value, E> {
        self.0.visit_bool(value)
    }

    fn visit_i64<E: de::Error>(self, value: i64) -> result::Result<V::Value, E> {
        self.0.visit_i64(value)
    }

    fn visit_u64<E: de::Error>(self, value: u64) -> result::Result<V::Value, E> {
        self.0.visit_u64(value)
    }

    fn visit_i128<E: de::Error>(self, value: i128) -> result::Result<V::Value, E> {
        self.0.visit_i128(value)
    }

    fn visit_u128<E: de::Error>(self, value: u128) -> result::Result<V::Value, E> {
        self.0.visit_u128(value)
    }

    fn visit_f64<E: de::Error>(self, value: f64) -> result::Result<V::Value, E> {
        self.0.visit_f64(value)
    }

    fn visit_char<E: de::Error>(self, value: char) -> result::Result<V::Value, E> {
        self.0.visit_char(value)
    }

    fn visit_str<E: de::Error>(self, value: &str) -> result::Result<V::Value, E> {
        self.0.visit_str(value)
    }

    fn visit_borrowed_str<E: de::Error>(self, value: &'de str) -> result::Result<V::Value, E> {
        self.0.visit_borrowed_str(value)
    }

    fn visit_string<E: de::Error>(self, value: String) -> result::Result<V::Value, E> {
        self.0.visit_string(value)
    }

    fn visit_bytes<E: de::Error>(self, value: &[u8]) -> result::Result<V::Value, E> {
        self.0.visit_bytes(value)
    }

    fn visit_borrowed_bytes<E: de::Error>(self, value: &'de [u8]) -> result::Result<V::Value, E> {
        self.0.visit_borrowed_bytes(value)
    }

    fn visit_byte_buf<E: de::Error>(self, value: Vec<u8>) -> result::Result<V::Value, E> {
        self.0.visit_byte_buf(value)
    }

    fn visit_unit<E: de::Error>(self) -> result::Result<V::Value, E> {
        self.0.visit_unit()
    }
    fn visit_none<E: de::Error>(self) -> result::Result<V::Value, E> {
        self.0.visit_none()
    }
    fn visit_some<D: Deserializer<'de>>(
        self,
        deserializer: D,
    ) -> result::Result<V::Value, D::Error> {
        self.0.visit_some(ObjectDeserializer(deserializer))
    }
    fn visit_newtype_struct<D: Deserializer<'de>>(
        self,
        deserializer: D,
    ) -> result::Result<V::Value, D::Error> {
        self.0
            .visit_newtype_struct(ObjectDeserializer(deserializer))
    }
    fn visit_seq<A: SeqAccess<'de>>(self, access: A) -> result::Result<V::Value, A::Error> {
        self.0.visit_seq(ObjectSequence(access))
    }
    fn visit_map<A: MapAccess<'de>>(self, access: A) -> result::Result<V::Value, A::Error> {
        self.0.visit_map(ObjectMap(access))
    }
    fn visit_enum<A: EnumAccess<'de>>(self, access: A) -> result::Result<V::Value, A::Error> {
        self.0.visit_enum(ObjectEnum(access))
    }
}

/// JSON string enums cannot use serde's alternate externally tagged map form.
pub(crate) struct StringEnumVisitor<V>(pub(crate) V);
impl<'de, V: Visitor<'de>> Visitor<'de> for StringEnumVisitor<V> {
    type Value = V::Value;
    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a string enum value")
    }
    fn visit_str<E: de::Error>(self, value: &str) -> result::Result<V::Value, E> {
        self.0.visit_enum(value.into_deserializer())
    }
    fn visit_borrowed_str<E: de::Error>(self, value: &'de str) -> result::Result<V::Value, E> {
        self.0.visit_enum(value.into_deserializer())
    }
}
