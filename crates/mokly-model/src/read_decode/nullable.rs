//! A field-local exception for a declared nullable value.

use std::fmt;
use std::marker::PhantomData;

use serde::de::Visitor;
use serde::{Deserialize, Deserializer};

pub(super) const MARKER: &str = "mokly-model::nullable";

/// Read one field whose declared wire type permits an explicit null.
pub(crate) fn read<'de, T: Deserialize<'de>, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<T>, D::Error> {
    deserializer.deserialize_newtype_struct(MARKER, Nullable(PhantomData))
}

struct Nullable<T>(PhantomData<T>);

impl<'de, T: Deserialize<'de>> Visitor<'de> for Nullable<T> {
    type Value = Option<T>;

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("a declared nullable value")
    }

    fn visit_newtype_struct<D: Deserializer<'de>>(
        self,
        deserializer: D,
    ) -> Result<Self::Value, D::Error> {
        Option::deserialize(deserializer)
    }
}
