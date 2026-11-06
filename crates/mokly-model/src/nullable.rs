//! A required public field whose value can be an explicit null.

use std::fmt;
use std::marker::PhantomData;

use serde::de::Visitor;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use ts_rs::{Config, TS, TypeVisitor};

/// Newtype name that presence-aware receiver decoding reads as a permitted null.
pub(crate) const MARKER: &str = "mokly-model::nullable";

/// A field that every document supplies, as a value or as an explicit null.
///
/// Every decoder reports an absent field as missing, the receiver readers
/// included. The type has no `Default`, so a field-level `#[serde(default)]`
/// does not compile. TypeScript declares the field as a required `T | null`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Nullable<T>(pub Option<T>);

impl<T: Serialize> Serialize for Nullable<T> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.0.serialize(serializer)
    }
}

impl<'de, T: Deserialize<'de>> Deserialize<'de> for Nullable<T> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_newtype_struct(MARKER, NullableVisitor(PhantomData))
    }
}

/// Reads the marked newtype as an optional inner value.
struct NullableVisitor<T>(PhantomData<T>);

impl<'de, T: Deserialize<'de>> Visitor<'de> for NullableVisitor<T> {
    type Value = Nullable<T>;

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("a value or an explicit null")
    }

    fn visit_newtype_struct<D: Deserializer<'de>>(
        self,
        deserializer: D,
    ) -> Result<Self::Value, D::Error> {
        Option::deserialize(deserializer).map(Nullable)
    }
}

impl<T: TS> TS for Nullable<T> {
    type WithoutGenerics = Self;
    type OptionInnerType = Self;

    fn name(config: &Config) -> String {
        format!("{} | null", T::name(config))
    }

    fn inline(config: &Config) -> String {
        format!("{} | null", T::inline(config))
    }

    fn visit_dependencies(visitor: &mut impl TypeVisitor)
    where
        Self: 'static,
    {
        T::visit_dependencies(visitor);
    }

    fn visit_generics(visitor: &mut impl TypeVisitor)
    where
        Self: 'static,
    {
        T::visit_generics(visitor);
        visitor.visit::<T>();
    }
}
