//! Read serde's declared enum spellings without maintaining a second catalogue.

use serde::de::{DeserializeOwned, Error, Visitor, value};
use serde::{Deserializer, forward_to_deserialize_any};

pub(super) fn enum_values<T: DeserializeOwned>() -> &'static [&'static str] {
    let mut values = &[][..];
    let _ = T::deserialize(EnumValues(&mut values));
    values
}

struct EnumValues<'a>(&'a mut &'static [&'static str]);

impl<'de> Deserializer<'de> for EnumValues<'_> {
    type Error = value::Error;

    fn deserialize_enum<V: Visitor<'de>>(
        self,
        _name: &'static str,
        variants: &'static [&'static str],
        _visitor: V,
    ) -> Result<V::Value, Self::Error> {
        *self.0 = variants;
        Err(value::Error::custom(
            "schema inspection does not construct an enum",
        ))
    }

    fn deserialize_any<V: Visitor<'de>>(self, _visitor: V) -> Result<V::Value, Self::Error> {
        Err(value::Error::custom("schema inspection requires an enum"))
    }

    forward_to_deserialize_any! {
        bool i8 i16 i32 i64 u8 u16 u32 u64 f32 f64 char str string bytes byte_buf
        option unit unit_struct newtype_struct seq tuple tuple_struct map struct
        identifier ignored_any
    }
}
