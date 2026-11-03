//! Preserve optional-field presence while delegating ordinary JSON conversions.
//!
//! Serde buffers derived tagged and untagged unions before decoding variants.
//! That buffer can bypass this wrapper. Public record unions therefore use the
//! raw decoders, whose fields re-enter `from_value`. The remaining untagged
//! public unions contain primitives or prop tuples, without optional records.

use serde::Deserializer;
use serde::de::{DeserializeOwned, Visitor};
use serde_json::Value;

use super::nullable;
use super::visitor::Wrapped;

/// Decode a supplied value without treating its null as optional-field absence.
pub(crate) fn from_value<T: DeserializeOwned>(value: Value) -> Result<T, serde_json::Error> {
    T::deserialize(Present::new(value))
}

pub(super) struct Present<D> {
    inner: D,
    nullable: bool,
}

impl<D> Present<D> {
    pub(super) fn new(inner: D) -> Self {
        Self {
            inner,
            nullable: false,
        }
    }
}

macro_rules! forward {
    ($($method:ident),* $(,)?) => {
        $(
            fn $method<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
                self.inner.$method(Wrapped(visitor))
            }
        )*
    };
}

impl<'de, D: Deserializer<'de>> Deserializer<'de> for Present<D> {
    type Error = D::Error;

    forward!(
        deserialize_any,
        deserialize_bool,
        deserialize_i8,
        deserialize_i16,
        deserialize_i32,
        deserialize_i64,
        deserialize_i128,
        deserialize_u8,
        deserialize_u16,
        deserialize_u32,
        deserialize_u64,
        deserialize_u128,
        deserialize_f32,
        deserialize_f64,
        deserialize_char,
        deserialize_str,
        deserialize_string,
        deserialize_bytes,
        deserialize_byte_buf,
        deserialize_unit,
        deserialize_seq,
        deserialize_map,
        deserialize_identifier,
        deserialize_ignored_any,
    );

    fn deserialize_option<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        if self.nullable {
            self.inner.deserialize_option(Wrapped(visitor))
        } else {
            visitor.visit_some(self)
        }
    }

    fn deserialize_newtype_struct<V: Visitor<'de>>(
        self,
        name: &'static str,
        visitor: V,
    ) -> Result<V::Value, Self::Error> {
        if name == nullable::MARKER {
            visitor.visit_newtype_struct(Self {
                inner: self.inner,
                nullable: true,
            })
        } else {
            self.inner
                .deserialize_newtype_struct(name, Wrapped(visitor))
        }
    }

    fn deserialize_unit_struct<V: Visitor<'de>>(
        self,
        name: &'static str,
        visitor: V,
    ) -> Result<V::Value, Self::Error> {
        self.inner.deserialize_unit_struct(name, Wrapped(visitor))
    }

    fn deserialize_tuple<V: Visitor<'de>>(
        self,
        len: usize,
        visitor: V,
    ) -> Result<V::Value, Self::Error> {
        self.inner.deserialize_tuple(len, Wrapped(visitor))
    }

    fn deserialize_tuple_struct<V: Visitor<'de>>(
        self,
        name: &'static str,
        len: usize,
        visitor: V,
    ) -> Result<V::Value, Self::Error> {
        self.inner
            .deserialize_tuple_struct(name, len, Wrapped(visitor))
    }

    fn deserialize_struct<V: Visitor<'de>>(
        self,
        name: &'static str,
        fields: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Self::Error> {
        self.inner
            .deserialize_struct(name, fields, Wrapped(visitor))
    }

    fn deserialize_enum<V: Visitor<'de>>(
        self,
        name: &'static str,
        variants: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Self::Error> {
        self.inner
            .deserialize_enum(name, variants, Wrapped(visitor))
    }

    fn is_human_readable(&self) -> bool {
        self.inner.is_human_readable()
    }
}
