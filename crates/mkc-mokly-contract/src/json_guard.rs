//! Streaming budgets shared across every JSON value, including ignored fields.

use std::cell::Cell;
use std::collections::HashSet;
use std::fmt;
use std::result;

use serde::de::{self, DeserializeSeed, Deserializer, MapAccess, SeqAccess, Visitor};
use sha2::{Digest, Sha256};

use crate::error::{Error, Limit, Rejection, Result, invalid};

/// Inclusive value depth, with the root at level one.
pub(crate) const JSON_DEPTH: usize = 256;
/// Values, containers and object keys visited per artifact.
pub(crate) const JSON_NODES: usize = 262_144;
/// Key digests retained across all currently open objects.
pub(crate) const JSON_KEYS: usize = 65_536;

#[derive(Default)]
struct Budget {
    nodes: Cell<usize>,
    keys: Cell<usize>,
    exceeded: Cell<Option<Limit>>,
    duplicate: Cell<bool>,
}

impl Budget {
    fn reject<E: de::Error>(&self, limit: Limit) -> E {
        self.exceeded.set(Some(limit));
        E::custom("JSON receiver quota exceeded")
    }

    fn node<E: de::Error>(&self) -> result::Result<(), E> {
        if self.nodes.get() == JSON_NODES {
            return Err(self.reject(Limit::JsonNodes));
        }
        self.nodes.set(self.nodes.get() + 1);
        Ok(())
    }
}

pub(crate) fn check(bytes: &[u8]) -> Result<()> {
    let budget = Budget::default();
    let mut deserializer = serde_json::Deserializer::from_slice(bytes);
    deserializer.disable_recursion_limit();
    let result = BoundedValue {
        budget: &budget,
        depth: 0,
    }
    .deserialize(&mut deserializer);
    if let Some(limit) = budget.exceeded.get() {
        return Err(Error::TooLarge { limit });
    }
    if budget.duplicate.get() {
        return Err(invalid(Rejection::DuplicateJsonKey));
    }
    if result.is_err() || deserializer.end().is_err() {
        return Err(invalid(Rejection::Json));
    }
    Ok(())
}

#[derive(Clone, Copy)]
struct BoundedValue<'a> {
    budget: &'a Budget,
    depth: usize,
}

impl<'de> DeserializeSeed<'de> for BoundedValue<'_> {
    type Value = ();

    fn deserialize<D: Deserializer<'de>>(self, deserializer: D) -> result::Result<(), D::Error> {
        if self.depth >= JSON_DEPTH {
            return Err(self.budget.reject(Limit::JsonDepth));
        }
        self.budget.node()?;
        deserializer.deserialize_any(Self {
            depth: self.depth + 1,
            ..self
        })
    }
}

impl<'de> Visitor<'de> for BoundedValue<'_> {
    type Value = ();

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("bounded JSON with unique object keys")
    }

    fn visit_unit<E>(self) -> result::Result<(), E> {
        Ok(())
    }

    fn visit_bool<E>(self, _: bool) -> result::Result<(), E> {
        Ok(())
    }

    fn visit_i64<E>(self, _: i64) -> result::Result<(), E> {
        Ok(())
    }

    fn visit_u64<E>(self, _: u64) -> result::Result<(), E> {
        Ok(())
    }

    fn visit_f64<E>(self, _: f64) -> result::Result<(), E> {
        Ok(())
    }

    fn visit_str<E>(self, _: &str) -> result::Result<(), E> {
        Ok(())
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut sequence: A) -> result::Result<(), A::Error> {
        while sequence.next_element_seed(self)?.is_some() {}
        Ok(())
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> result::Result<(), A::Error> {
        let mut keys = HashSet::new();
        while let Some(key) = map.next_key_seed(KeyDigest(self.budget))? {
            if keys.contains(&key) {
                self.budget.duplicate.set(true);
            } else {
                if self.budget.keys.get() == JSON_KEYS {
                    return Err(self.budget.reject(Limit::JsonKeys));
                }
                self.budget.keys.set(self.budget.keys.get() + 1);
                keys.insert(key);
            }
            map.next_value_seed(self)?;
        }
        self.budget.keys.set(self.budget.keys.get() - keys.len());
        Ok(())
    }
}

/// Hash decoded key text without allocating an owned String for each key.
struct KeyDigest<'a>(&'a Budget);

impl<'de> DeserializeSeed<'de> for KeyDigest<'_> {
    type Value = [u8; 32];

    fn deserialize<D: Deserializer<'de>>(
        self,
        deserializer: D,
    ) -> result::Result<Self::Value, D::Error> {
        self.0.node()?;
        deserializer.deserialize_str(self)
    }
}

impl Visitor<'_> for KeyDigest<'_> {
    type Value = [u8; 32];

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON object key")
    }

    fn visit_str<E>(self, key: &str) -> result::Result<Self::Value, E> {
        Ok(Sha256::digest(key.as_bytes()).into())
    }
}
