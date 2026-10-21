//! Preserve runtime categories without exposing nested library error prefixes.

use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};

use crate::error::{Error, FailureKind, RemoteCode, RequestCode};

impl Error {
    /// Expected terminal data, absent for an unhandled infrastructure failure.
    pub fn diagnostic(&self) -> Option<RuntimeDiagnostic> {
        let (code, message) = match self {
            Self::Postcss { source } => return Some(source.diagnostic()),
            Self::Unavailable { part } => {
                (RuntimeCode::Unavailable, format!("{part} is unavailable"))
            }
            Self::Version { expected, actual } => (
                RuntimeCode::Version,
                format!("expected {expected}, received {actual}"),
            ),
            Self::Protocol(source) => (RuntimeCode::Protocol, source.to_string()),
            Self::Cancelled => (RuntimeCode::Cancelled, "build cancelled".into()),
            Self::Crashed => (
                RuntimeCode::Render,
                "sidecar exited during a request".into(),
            ),
            Self::UnknownGeneration { generation } => (
                RuntimeCode::Bundle,
                format!("unknown generation {generation}"),
            ),
            Self::GenerationChanged { generation } => (
                RuntimeCode::Bundle,
                format!("generation {generation} changed while reloading"),
            ),
            Self::RequestTimeout {
                call,
                deadline_ms,
                phase,
            } => (
                RuntimeCode::Timeout,
                format!(
                    "{call} exceeded {deadline_ms}ms{}",
                    phase
                        .as_deref()
                        .map_or_else(String::new, |phase| format!("; {phase}"))
                ),
            ),
            Self::Timeout { deadline_ms, .. } => (
                RuntimeCode::Timeout,
                format!("request exceeded {deadline_ms}ms"),
            ),
            Self::RequestCrashed { kind, call } => (
                match kind {
                    FailureKind::Bundle => RuntimeCode::Bundle,
                    FailureKind::Render => RuntimeCode::Render,
                },
                format!("sidecar exited twice during {call}"),
            ),
            Self::Remote { code, message } => (
                match code {
                    RemoteCode::Request(RequestCode::BundleFailed) => RuntimeCode::Bundle,
                    RemoteCode::Request(RequestCode::RenderFailed) => RuntimeCode::Render,
                    RemoteCode::Request(RequestCode::SidecarProtocol) => RuntimeCode::Protocol,
                    RemoteCode::Definition(_) => RuntimeCode::Build,
                },
                match code {
                    RemoteCode::Definition(code) => format!("[mokly/{code}] {message}"),
                    _ => message.clone(),
                },
            ),
            Self::Internal(_) => return None,
        };
        Some(RuntimeDiagnostic { code, message })
    }
}
