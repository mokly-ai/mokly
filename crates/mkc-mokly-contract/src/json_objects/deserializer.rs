//! Require JSON maps whenever serde requests a protocol struct.

use std::result;

use serde::de::{Deserializer, Visitor};

use super::visitor::{ObjectVisitor, StringEnumVisitor};

/// Keep each serde primitive's own type check while wrapping nested visitors.
macro_rules! delegate_visitor {
    ($($method:ident),+ $(,)?) => {
        $(fn $method<V: Visitor<'de>>(self, visitor: V) -> result::Result<V::Value, D::Error> {
            self.0.$method(ObjectVisitor(visitor))
        })+
    };
}

/// Pure adapter that preserves borrowed JSON while refusing positional structs.
pub(crate) struct ObjectDeserializer<D>(pub(crate) D);

impl<'de, D: Deserializer<'de>> Deserializer<'de> for ObjectDeserializer<D> {
    type Error = D::Error;

    fn deserialize_any<V: Visitor<'de>>(self, visitor: V) -> result::Result<V::Value, D::Error> {
        self.0.deserialize_any(ObjectVisitor(visitor))
    }

    fn deserialize_struct<V: Visitor<'de>>(
        self,
        _: &'static str,
        _: &'static [&'static str],
        visitor: V,
    ) -> result::Result<V::Value, D::Error> {
        self.0.deserialize_map(ObjectVisitor(visitor))
    }

    fn deserialize_option<V: Visitor<'de>>(self, visitor: V) -> result::Result<V::Value, D::Error> {
        self.0.deserialize_option(ObjectVisitor(visitor))
    }

    fn deserialize_newtype_struct<V: Visitor<'de>>(
        self,
        name: &'static str,
        visitor: V,
    ) -> result::Result<V::Value, D::Error> {
        self.0
            .deserialize_newtype_struct(name, ObjectVisitor(visitor))
    }

    fn deserialize_enum<V: Visitor<'de>>(
        self,
        _name: &'static str,
        _variants: &'static [&'static str],
        visitor: V,
    ) -> result::Result<V::Value, D::Error> {
        self.0.deserialize_str(StringEnumVisitor(visitor))
    }

    fn deserialize_identifier<V: Visitor<'de>>(
        self,
        visitor: V,
    ) -> result::Result<V::Value, D::Error> {
        self.0.deserialize_str(ObjectVisitor(visitor))
    }

    delegate_visitor! {
        deserialize_bool, deserialize_i8, deserialize_i16, deserialize_i32,
        deserialize_i64, deserialize_i128, deserialize_u8, deserialize_u16,
        deserialize_u32, deserialize_u64, deserialize_u128, deserialize_f32,
        deserialize_f64, deserialize_char, deserialize_str, deserialize_string,
        deserialize_bytes, deserialize_byte_buf, deserialize_unit, deserialize_seq,
        deserialize_map, deserialize_ignored_any
    }

    fn deserialize_unit_struct<V: Visitor<'de>>(
        self,
        name: &'static str,
        visitor: V,
    ) -> result::Result<V::Value, D::Error> {
        self.0.deserialize_unit_struct(name, ObjectVisitor(visitor))
    }
    fn deserialize_tuple<V: Visitor<'de>>(
        self,
        len: usize,
        visitor: V,
    ) -> result::Result<V::Value, D::Error> {
        self.0.deserialize_tuple(len, ObjectVisitor(visitor))
    }
    fn deserialize_tuple_struct<V: Visitor<'de>>(
        self,
        name: &'static str,
        len: usize,
        visitor: V,
    ) -> result::Result<V::Value, D::Error> {
        self.0
            .deserialize_tuple_struct(name, len, ObjectVisitor(visitor))
    }
}
