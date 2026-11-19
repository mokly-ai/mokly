//! Decode envelopes without materializing generic trees for method payloads.

use std::fmt;

use serde::de::{self, DeserializeOwned, IgnoredAny, MapAccess, Visitor};
use serde::{Deserialize, Deserializer};
use serde_json::value::RawValue;

use crate::operations::Operation;
use crate::wire::{Event, Frame, RemoteError, Response};

#[derive(Default)]
struct Envelope {
    id: RawField,
    result: RawField,
    error: RawField,
    event: RawField,
    params: RawField,
}

/// Keep duplicates local to the candidates that use this field.
#[derive(Default)]
struct RawField {
    value: Option<Box<RawValue>>,
    duplicate: bool,
}

impl RawField {
    fn unique(&self) -> Option<&RawValue> {
        self.value.as_deref().filter(|_| !self.duplicate)
    }
}

impl Envelope {
    fn response(&mut self) -> Option<Response> {
        let id = serde_json::from_str::<u64>(self.id.unique()?.get()).ok()?;
        if !self.result.duplicate
            && let Some(result) = self.result.value.take()
        {
            return Some(Response::Success { id, result });
        }
        let error = serde_json::from_str::<RemoteError>(self.error.unique()?.get()).ok()?;
        Some(Response::Failure { id, error })
    }
}

#[derive(Deserialize)]
#[serde(field_identifier, rename_all = "lowercase")]
enum Field {
    Id,
    Result,
    Error,
    Event,
    Params,
    #[serde(other)]
    Other,
}

struct EnvelopeVisitor;

impl<'de> Visitor<'de> for EnvelopeVisitor {
    type Value = Envelope;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a sidecar response or event envelope")
    }

    fn visit_map<A>(self, mut map: A) -> Result<Envelope, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut envelope = Envelope::default();
        while let Some(field) = map.next_key()? {
            let target = match field {
                Field::Id => &mut envelope.id,
                Field::Result => &mut envelope.result,
                Field::Error => &mut envelope.error,
                Field::Event => &mut envelope.event,
                Field::Params => &mut envelope.params,
                Field::Other => {
                    map.next_value::<IgnoredAny>()?;
                    continue;
                }
            };
            if target.value.is_some() {
                target.duplicate = true;
                map.next_value::<IgnoredAny>()?;
            } else {
                target.value = Some(map.next_value()?);
            }
        }
        Ok(envelope)
    }
}

impl<'de> Deserialize<'de> for Response {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let mut envelope = deserializer.deserialize_map(EnvelopeVisitor)?;
        envelope.response().ok_or_else(|| {
            de::Error::custom("data did not match any variant of untagged enum Response")
        })
    }
}

impl<'de> Deserialize<'de> for Frame {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let mut envelope = deserializer.deserialize_map(EnvelopeVisitor)?;
        if let Some(response) = envelope.response() {
            return Ok(Self::Response(response));
        }
        let event: String = decode(required(&envelope.event, "event")?)?;
        let params = required(&envelope.params, "params")?;
        let event = match event.as_str() {
            "operation" => {
                let OperationParams { operation, pid } = decode(params)?;
                Event::Operation { operation, pid }
            }
            "diagnostic" => {
                let DiagnosticParams { message } = decode(params)?;
                Event::Diagnostic { message }
            }
            _ => {
                return Err(de::Error::unknown_variant(
                    &event,
                    &["operation", "diagnostic"],
                ));
            }
        };
        Ok(Self::Event(event))
    }
}

#[derive(Deserialize)]
struct OperationParams {
    operation: Operation,
    pid: u32,
}

#[derive(Deserialize)]
struct DiagnosticParams {
    message: String,
}

fn required<'a, E: de::Error>(field: &'a RawField, name: &'static str) -> Result<&'a RawValue, E> {
    if field.duplicate {
        return Err(de::Error::duplicate_field(name));
    }
    field
        .value
        .as_deref()
        .ok_or_else(|| de::Error::missing_field(name))
}

fn decode<T: DeserializeOwned, E: de::Error>(value: &RawValue) -> Result<T, E> {
    match serde_json::from_str(value.get()) {
        Ok(value) => Ok(value),
        Err(error) => Err(de::Error::custom(error)),
    }
}
