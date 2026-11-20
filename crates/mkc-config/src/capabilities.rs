//! Explicit configuration exceptions; previews never inherit development mode.

use crate::settings::{Error, Result};

/// Parsed only at startup; callers consume named capabilities instead of the mode.
pub(super) enum DeploymentEnvironment {
    Production,
    Preview,
    Development,
}

/// Every relaxation is independently selected for each deployment environment.
pub(super) struct Capabilities {
    pub(super) log_mail: bool,
    pub(super) http_loopback: bool,
    pub(super) preview_sign_in: bool,
}

impl DeploymentEnvironment {
    pub(super) fn parse(value: Option<&str>) -> Result<Self> {
        match value {
            Some("production") | None => Ok(Self::Production),
            Some("preview") => Ok(Self::Preview),
            Some("development") => Ok(Self::Development),
            _ => Err(Error::Invalid("MKC_ENV")),
        }
    }

    pub(super) const fn capabilities(&self) -> Capabilities {
        match self {
            Self::Production => Capabilities {
                log_mail: false,
                http_loopback: false,
                preview_sign_in: false,
            },
            Self::Preview => Capabilities {
                log_mail: true,
                http_loopback: false,
                preview_sign_in: true,
            },
            Self::Development => Capabilities {
                log_mail: true,
                http_loopback: true,
                preview_sign_in: true,
            },
        }
    }
}
