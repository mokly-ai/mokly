//! Repository identity and GitHub Actions revision context.

use serde::{Deserialize, Serialize};
use url::Url;

use crate::error::{Error, Result};

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
            return Err(Error::Repository);
        };
        let Some((owner, name)) = path.rsplit_once('/') else {
            return Err(Error::Repository);
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
                return Err(Error::Repository);
            };
            if !matches!(url.scheme(), "https" | "http" | "ssh")
                || url.query().is_some()
                || url.fragment().is_some()
            {
                return Err(Error::Repository);
            }
            let Some(host) = url.host_str() else {
                return Err(Error::Repository);
            };
            let Some((_, raw)) = value.split_once("://") else {
                return Err(Error::Repository);
            };
            let Some((_, path)) = raw.split_once('/') else {
                return Err(Error::Repository);
            };
            return Self::parse(&format!("{}/{path}", host.to_lowercase()));
        }
        let Some((authority, path)) = value.split_once(':') else {
            return Err(Error::Repository);
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
            return Err(Error::Repository);
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

/// Environment values read once by the CLI composition root.
#[derive(Clone, Debug, Default)]
pub struct ActionsContext {
    /// GITHUB_ACTIONS, interpreted only when exactly true.
    pub actions: Option<String>,
    /// GITHUB_HEAD_REF for a pull request.
    pub head_ref: Option<String>,
    /// GITHUB_REF_TYPE for a branch run.
    pub ref_type: Option<String>,
    /// GITHUB_REF_NAME for a branch run.
    pub ref_name: Option<String>,
    /// GITHUB_REF for the optional pull request number.
    pub git_ref: Option<String>,
}

impl ActionsContext {
    /// Resolve the branch name without replacing the actual checked-out SHA.
    pub fn branch(&self, symbolic: &str) -> String {
        if self.actions.as_deref() == Some("true") {
            if let Some(head) = self.head_ref.as_ref().filter(|value| !value.is_empty()) {
                return head.clone();
            }
            if self.ref_type.as_deref() == Some("branch")
                && let Some(name) = self.ref_name.as_ref().filter(|value| !value.is_empty())
            {
                return name.clone();
            }
        }
        if symbolic.is_empty() {
            "HEAD".to_owned()
        } else {
            symbolic.to_owned()
        }
    }

    /// A positive JavaScript-safe pull request number, only in Actions.
    pub fn pull_request(&self) -> Option<u64> {
        if self.actions.as_deref() != Some("true") {
            return None;
        }
        let value = self.git_ref.as_deref()?.strip_prefix("refs/pull/")?;
        let (number, kind) = value.split_once('/')?;
        if number.starts_with('0')
            || !matches!(kind, "merge" | "head")
            || !number.bytes().all(|byte| byte.is_ascii_digit())
        {
            return None;
        }
        number
            .parse::<u64>()
            .ok()
            .filter(|number| (1..=9_007_199_254_740_991).contains(number))
    }
}
