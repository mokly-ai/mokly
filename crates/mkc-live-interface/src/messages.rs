//! JSON objects sent and received by a project socket.

use std::collections::BTreeMap;

use serde::de::Error;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
#[cfg(feature = "openapi")]
use utoipa::ToSchema;
use uuid::Uuid;

/// A stored record changed. Read the record through its REST operation.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "openapi", derive(ToSchema))]
pub struct Notice {
    /// The kind of stored record.
    pub kind: String,
    /// The identity of the changed record.
    pub id: Uuid,
    /// The sequence defined by the notice kind.
    pub sequence: i64,
}

/// The messages that the server creates.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "openapi", derive(ToSchema))]
#[serde(rename_all = "kebab-case", tag = "type")]
pub enum ServerSignal {
    /// One stored record changed.
    Notice(Notice),
    /// Read again each kind shown by the client.
    Resync,
}

/// A client event uses its kind as the message type.
///
/// Each registered kind defines its own fields in the same JSON object.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "openapi", derive(ToSchema))]
pub struct ClientEvent {
    #[serde(rename = "type", deserialize_with = "client_event_type")]
    #[cfg_attr(
        feature = "openapi",
        schema(pattern = r"^(?!(?:notice|resync)(?![\s\S]))")
    )]
    kind: String,
    #[serde(flatten)]
    fields: BTreeMap<String, Value>,
}

impl ClientEvent {
    /// The value of the message's `type` field.
    pub fn kind(&self) -> &str {
        &self.kind
    }
}

fn client_event_type<'de, D: Deserializer<'de>>(deserializer: D) -> Result<String, D::Error> {
    let kind = String::deserialize(deserializer)?;
    match kind.as_str() {
        "notice" | "resync" => Err(D::Error::custom("message type is reserved by the server")),
        _ => Ok(kind),
    }
}

/// A message sent to a project socket in one text frame.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "openapi", derive(ToSchema))]
#[serde(untagged)]
pub enum ServerMessage {
    /// A notice or resync signal from the server.
    Signal(ServerSignal),
    /// An event sent by another socket of the project.
    ClientEvent(ClientEvent),
}

#[cfg(test)]
#[path = "_tests_/messages_tests.rs"]
mod messages_tests;
