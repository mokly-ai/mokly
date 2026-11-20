//! Recursively wrap collection seeds without buffering an untyped JSON tree.

use std::result;

use serde::de::{
    DeserializeSeed, Deserializer, EnumAccess, MapAccess, SeqAccess, VariantAccess, Visitor,
};

use super::deserializer::ObjectDeserializer;
use super::visitor::ObjectVisitor;

/// Apply the object adapter to a nested key, value or collection element seed.
struct ObjectSeed<S>(S);

impl<'de, S: DeserializeSeed<'de>> DeserializeSeed<'de> for ObjectSeed<S> {
    type Value = S::Value;
    fn deserialize<D: Deserializer<'de>>(
        self,
        deserializer: D,
    ) -> result::Result<S::Value, D::Error> {
        self.0.deserialize(ObjectDeserializer(deserializer))
    }
}

/// Preserve map order and borrowed values while adapting every nested seed.
pub(crate) struct ObjectMap<A>(pub(crate) A);
impl<'de, A: MapAccess<'de>> MapAccess<'de> for ObjectMap<A> {
    type Error = A::Error;
    fn next_key_seed<S: DeserializeSeed<'de>>(
        &mut self,
        seed: S,
    ) -> result::Result<Option<S::Value>, A::Error> {
        self.0.next_key_seed(ObjectSeed(seed))
    }
    fn next_value_seed<S: DeserializeSeed<'de>>(
        &mut self,
        seed: S,
    ) -> result::Result<S::Value, A::Error> {
        self.0.next_value_seed(ObjectSeed(seed))
    }
    fn size_hint(&self) -> Option<usize> {
        self.0.size_hint()
    }
}

/// Adapt sequence elements without buffering or changing their order.
pub(crate) struct ObjectSequence<A>(pub(crate) A);
impl<'de, A: SeqAccess<'de>> SeqAccess<'de> for ObjectSequence<A> {
    type Error = A::Error;
    fn next_element_seed<S: DeserializeSeed<'de>>(
        &mut self,
        seed: S,
    ) -> result::Result<Option<S::Value>, A::Error> {
        self.0.next_element_seed(ObjectSeed(seed))
    }
    fn size_hint(&self) -> Option<usize> {
        self.0.size_hint()
    }
}

/// Keep serde enum access while adapting its variant-name seed and payload.
pub(crate) struct ObjectEnum<A>(pub(crate) A);
impl<'de, A: EnumAccess<'de>> EnumAccess<'de> for ObjectEnum<A> {
    type Error = A::Error;
    type Variant = ObjectVariant<A::Variant>;
    fn variant_seed<S: DeserializeSeed<'de>>(
        self,
        seed: S,
    ) -> result::Result<(S::Value, Self::Variant), A::Error> {
        let (value, variant) = self.0.variant_seed(ObjectSeed(seed))?;
        Ok((value, ObjectVariant(variant)))
    }
}

/// Carry object rules through newtype, tuple and struct variant payloads.
pub(crate) struct ObjectVariant<A>(A);
impl<'de, A: VariantAccess<'de>> VariantAccess<'de> for ObjectVariant<A> {
    type Error = A::Error;
    fn unit_variant(self) -> result::Result<(), A::Error> {
        self.0.unit_variant()
    }
    fn newtype_variant_seed<S: DeserializeSeed<'de>>(
        self,
        seed: S,
    ) -> result::Result<S::Value, A::Error> {
        self.0.newtype_variant_seed(ObjectSeed(seed))
    }
    fn tuple_variant<V: Visitor<'de>>(
        self,
        len: usize,
        visitor: V,
    ) -> result::Result<V::Value, A::Error> {
        self.0.tuple_variant(len, ObjectVisitor(visitor))
    }
    fn struct_variant<V: Visitor<'de>>(
        self,
        fields: &'static [&'static str],
        visitor: V,
    ) -> result::Result<V::Value, A::Error> {
        self.0.struct_variant(fields, ObjectVisitor(visitor))
    }
}
