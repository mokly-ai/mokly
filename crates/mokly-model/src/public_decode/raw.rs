//! JSON-boundary field access retains presence until variant checks finish.

use serde::de::{DeserializeOwned, Error};
use serde::{Deserialize, Deserializer};
use serde_json::{Map, Value};

use crate::read_decode::value;

#[derive(Deserialize)]
#[serde(transparent)]
pub(super) struct Record(Map<String, Value>);

impl Record {
    pub(super) fn read<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        Self::deserialize(deserializer)
    }

    pub(super) fn required<T: DeserializeOwned, E: Error>(
        &mut self,
        key: &'static str,
    ) -> Result<T, E> {
        match self.0.remove(key) {
            Some(value) => decode(value),
            None => Err(E::missing_field(key)),
        }
    }

    pub(super) fn optional<T: DeserializeOwned, E: Error>(
        &mut self,
        key: &'static str,
    ) -> Result<Option<T>, E> {
        match self.0.remove(key) {
            None => Ok(None),
            Some(value) => Ok(Some(decode(value)?)),
        }
    }

    pub(super) fn reject<E: Error>(&self, fields: &[&str]) -> Result<(), E> {
        if fields.iter().any(|field| self.0.contains_key(*field)) {
            return Err(E::custom("field belongs to another record variant"));
        }
        Ok(())
    }

    pub(super) fn kind<E: Error>(&self) -> Result<&str, E> {
        match self.0.get("kind") {
            Some(Value::String(kind)) => Ok(kind),
            Some(_) => Err(E::custom("expected a string kind")),
            None => Err(E::missing_field("kind")),
        }
    }

    pub(super) fn decode<T: DeserializeOwned, E: Error>(self) -> Result<T, E> {
        decode(Value::Object(self.0))
    }
}

fn decode<T: DeserializeOwned, E: Error>(value: Value) -> Result<T, E> {
    match value::from_value(value) {
        Ok(value) => Ok(value),
        Err(error) => Err(E::custom(error)),
    }
}
