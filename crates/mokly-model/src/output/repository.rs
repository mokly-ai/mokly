//! Portable repository identity used by upload metadata.

use serde::{Deserialize, Serialize};
use url::Url;

use crate::output::error::{FormatError, Result};

/// Portable repository identity, without credentials or transport details.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Repository {
    /// Lowercase DNS hostname or IPv4 address, without a port.
    pub host: String,
    /// Slash-separated owner or nested groups.
    pub owner: String,
    /// One repository name segment.
    pub name: String,
}

impl Repository {
    /// Parse the explicit host/owner/name option.
    pub fn parse(value: &str) -> Result<Self> {
        let Some((host, path)) = value.split_once('/') else {
            return Err(FormatError::Repository);
        };
        let Some((owner, name)) = path.rsplit_once('/') else {
            return Err(FormatError::Repository);
        };
        let repository = Self {
            host: host.to_ascii_lowercase(),
            owner: owner.to_owned(),
            name: name.strip_suffix(".git").unwrap_or(name).to_owned(),
        };
        repository.validate()?;
        Ok(repository)
    }

    /// Parse HTTPS, SSH, or scp-style remote transport into a safe identity.
    pub fn remote(value: &str) -> Result<Self> {
        if value.contains("://") {
            let Ok(url) = Url::parse(value) else {
                return Err(FormatError::Repository);
            };
            if !matches!(url.scheme(), "https" | "http" | "ssh")
                || url.query().is_some()
                || url.fragment().is_some()
            {
                return Err(FormatError::Repository);
            }
            let Some(host) = url.host_str() else {
                return Err(FormatError::Repository);
            };
            let Some((_, raw)) = value.split_once("://") else {
                return Err(FormatError::Repository);
            };
            let Some((_, path)) = raw.split_once('/') else {
                return Err(FormatError::Repository);
            };
            return Self::parse(&format!("{}/{path}", host.to_lowercase()));
        }
        let Some((authority, path)) = value.split_once(':') else {
            return Err(FormatError::Repository);
        };
        let host = authority.rsplit('@').next().unwrap_or(authority);
        Self::parse(&format!("{}/{}", host.to_lowercase(), path))
    }

    /// Check metadata lengths and the documented ASCII segment grammar.
    pub fn validate(&self) -> Result<()> {
        if self.host.is_empty()
            || self.host.len() > 253
            || self.host != self.host.to_ascii_lowercase()
            || self.host.split('.').any(|part| {
                part.is_empty()
                    || part.starts_with('-')
                    || part.ends_with('-')
                    || part.len() > 63
                    || !part.bytes().all(|byte| {
                        byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-'
                    })
            })
            || self.owner.len() > 255
            || self.name.len() > 255
            || !self.owner.split('/').all(segment)
            || !segment(&self.name)
        {
            return Err(FormatError::Repository);
        }
        Ok(())
    }
}

fn segment(value: &str) -> bool {
    !matches!(value, "" | "." | "..")
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(&byte))
}
