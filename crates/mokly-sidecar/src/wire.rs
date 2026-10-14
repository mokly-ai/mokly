//! Request, response and event envelopes.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::definitions::Definitions;
use crate::error::{Error, ProtocolError, RemoteCode, Result};
use crate::methods::Call;
use crate::results;

/// A client request; params are present even for no-argument methods.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Request {
    /// Request identity repeated in the response.
    pub id: u64,
    /// Method and its structured params.
    #[serde(flatten)]
    pub call: Call,
}

/// Structured remote failure.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct RemoteError {
    /// Protocol error category.
    pub code: RemoteCode,
    /// Safe detail, with entry or module attribution.
    pub message: String,
}

/// Exactly one response outcome; raw JSON is decoded using the pending method.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(untagged, deny_unknown_fields)]
pub enum Response {
    /// A successful method result.
    Success {
        /// Request identity.
        id: u64,
        /// JSON boundary decoded immediately by decode_result.
        result: Value,
    },
    /// A failed method result.
    Failure {
        /// Request identity.
        id: u64,
        /// Structured remote failure.
        error: RemoteError,
    },
}

/// Asynchronous sidecar diagnostics, without request ids.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(
    tag = "event",
    content = "params",
    rename_all = "camelCase",
    deny_unknown_fields
)]
pub enum Event {
    /// Consumer or sidecar diagnostic output.
    Diagnostic {
        /// Diagnostic text forwarded through the terminal reporter.
        message: String,
    },
}

/// One inbound client frame; requests from the peer are invalid.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(untagged)]
pub enum Frame {
    /// A response to the outstanding request.
    Response(Response),
    /// An asynchronous event.
    Event(Event),
}

/// Fully decoded result of the corresponding request method.
#[derive(Clone, Debug)]
pub enum MethodResult {
    /// Hello package version.
    Hello(results::Hello),
    /// Bundle generation and module graph.
    Bundle(results::Bundle),
    /// Exported definitions.
    Definitions(Definitions),
    /// Fragment render.
    Render(results::Render),
    /// Complete page render.
    Page(results::Page),
    /// Consumer stylesheet transformation.
    Css(results::Css),
    /// No return value.
    Empty,
}

impl Response {
    /// Verify correlation before reading any result or remote error.
    pub fn decode_result(self, request: &Request) -> Result<MethodResult> {
        let id = match &self {
            Self::Success { id, .. } | Self::Failure { id, .. } => *id,
        };
        if id != request.id {
            return Err(Error::Protocol(ProtocolError::ResponseId {
                expected: request.id,
                actual: id,
            }));
        }
        match self {
            Self::Failure { error, .. } => Err(Error::Remote {
                code: error.code,
                message: error.message,
            }),
            Self::Success { result, .. } => match &request.call {
                Call::Hello(_) => Ok(MethodResult::Hello(decode(result)?)),
                Call::Bundle(_) => Ok(MethodResult::Bundle(decode(result)?)),
                Call::Describe(_) => Ok(MethodResult::Definitions(decode(result)?)),
                Call::RenderScreen(_) | Call::RenderComponent(_) | Call::RenderStory(_) => {
                    Ok(MethodResult::Render(decode(result)?))
                }
                Call::RenderPage(_) => Ok(MethodResult::Page(decode(result)?)),
                Call::ProcessCss(_) => Ok(MethodResult::Css(decode(result)?)),
                Call::CssModules(_) | Call::Dispose(_) | Call::Shutdown(_) => {
                    decode::<()>(result)?;
                    Ok(MethodResult::Empty)
                }
            },
        }
    }
}

fn decode<T: serde::de::DeserializeOwned>(value: Value) -> Result<T> {
    match serde_json::from_value(value) {
        Ok(value) => Ok(value),
        Err(source) => Err(Error::Protocol(ProtocolError::Json { source })),
    }
}

#[cfg(test)]
#[path = "_tests_/wire_tests.rs"]
mod wire_tests;
