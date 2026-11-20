//! Upload v3 envelope, independent of ownership and catalogue versions.

use chrono::NaiveDateTime;
use semver::Version;
use serde::{Deserialize, Serialize};

use crate::error::{ArtifactKind, Error, Rejection, Result, invalid};
use crate::json::{self, SchemaVersion};
use crate::json_integer;
use crate::limits::Limits;
use crate::paths;

/// Producer-asserted repository identity; authorization belongs to the API.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Repository {
    /// Lowercase DNS/IPv4 hostname, without a port.
    pub host: String,
    /// Owner or slash-separated group path.
    pub owner: String,
    /// Repository name.
    pub name: String,
}

/// The exact ten-field public upload envelope.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UploadManifest {
    /// Envelope schema, currently 3.
    #[serde(deserialize_with = "json_integer::integer")]
    pub schema_version: u64,
    /// Installed producer's exact SemVer.
    pub mokly_version: String,
    /// Claimed source repository.
    pub repository: Repository,
    /// Producer branch context, including detached `HEAD`.
    pub branch: String,
    /// Actual checked-out Git object id.
    pub head_sha: String,
    /// Effective comparison ref, null for current-only uploads.
    #[serde(deserialize_with = "json::nullable")]
    pub base_ref: Option<String>,
    /// Pinned merge base, never the moving base-ref tip.
    #[serde(deserialize_with = "json::nullable")]
    pub base_sha: Option<String>,
    /// Positive JavaScript-safe pull request number, or null.
    #[serde(deserialize_with = "json_integer::nullable_integer")]
    pub pull_request: Option<u64>,
    /// Safe config path relative to the repository root.
    pub config_path: String,
    /// Client-reported UTC time with exactly millisecond precision.
    pub exported_at: String,
}

impl UploadManifest {
    /// Decode and validate the envelope, including required nullable fields.
    pub fn parse(bytes: &[u8], limits: Limits) -> Result<Self> {
        Self::probe(bytes, limits)?;
        let manifest: Self = json::decode(bytes)?;
        manifest.validate(limits)?;
        Ok(manifest)
    }

    pub(crate) fn probe(bytes: &[u8], limits: Limits) -> Result<()> {
        limits.check_file(bytes.len() as u64, Some(ArtifactKind::Envelope))?;
        match json::schema_version(bytes, 3)? {
            SchemaVersion::Missing => return Err(invalid(Rejection::Manifest)),
            SchemaVersion::Unsupported(version) => {
                return Err(Error::UnsupportedVersion {
                    artifact: ArtifactKind::Envelope,
                    version,
                });
            }
            SchemaVersion::Supported => {}
        }
        Ok(())
    }

    fn validate(&self, limits: Limits) -> Result<()> {
        paths::validate(&self.config_path, limits)?;
        if self.mokly_version.len() > 255
            || Version::parse(&self.mokly_version).is_err()
            || !label(&self.branch)
            || !sha(&self.head_sha)
            || self
                .pull_request
                .is_some_and(|n| n == 0 || n > 9_007_199_254_740_991)
            || !timestamp(&self.exported_at)
            || !self.repository.valid()
        {
            return Err(invalid(Rejection::Manifest));
        }
        match (&self.base_ref, &self.base_sha) {
            (None, None) => Ok(()),
            (Some(base), Some(commit)) if label(base) && sha(commit) => Ok(()),
            _ => Err(invalid(Rejection::Manifest)),
        }
    }
}

impl Repository {
    fn valid(&self) -> bool {
        let host = &self.host;
        !host.is_empty()
            && host.len() <= 253
            && host.split('.').all(|part| {
                !part.is_empty()
                    && part.len() <= 63
                    && part
                        .bytes()
                        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
                    && part.as_bytes()[0].is_ascii_alphanumeric()
                    && part.as_bytes()[part.len() - 1].is_ascii_alphanumeric()
            })
            && self.owner.len() <= 255
            && self.owner.split('/').all(segment)
            && self.name.len() <= 255
            && segment(&self.name)
    }
}

fn segment(value: &str) -> bool {
    !matches!(value, "" | "." | "..")
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'))
}

pub(crate) fn label(value: &str) -> bool {
    !value.is_empty() && value.len() <= 255 && !value.chars().any(char::is_control)
}

pub(crate) fn hex(value: &str, length: usize) -> bool {
    value.len() == length
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

pub(crate) fn sha(value: &str) -> bool {
    hex(value, 40) || hex(value, 64)
}

fn timestamp(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 24
        && bytes.iter().enumerate().all(|(i, b)| match i {
            4 | 7 => *b == b'-',
            10 => *b == b'T',
            13 | 16 => *b == b':',
            19 => *b == b'.',
            23 => *b == b'Z',
            _ => b.is_ascii_digit(),
        })
        && &bytes[17..19] < b"60".as_slice()
        && NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S%.3fZ").is_ok()
}

#[cfg(test)]
#[path = "_tests_/manifest_tests.rs"]
mod manifest_tests;
