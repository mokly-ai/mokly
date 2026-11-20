//! The version-one run request and its revision and environment checks.

use std::result;

use serde::{Deserialize, Deserializer};

use super::error::{Error, ErrorResultExt, Failure, Result, require};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Request {
    pub(super) schema_version: u32,
    pub(super) environment: String,
    pub(super) revision: String,
    #[serde(deserialize_with = "nullable_pull_request")]
    pub(super) pull_request: Option<u32>,
}

impl Request {
    pub(super) fn parse(bytes: &[u8]) -> Result<Self> {
        let request: Self = serde_json::from_slice(bytes).context("decode seed request")?;
        if request.schema_version != 1 {
            return Err(invalid("schemaVersion"));
        }
        if request.revision.len() != 40
            || !request
                .revision
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        {
            return Err(invalid("revision"));
        }
        if request.environment == "local" {
            if request.pull_request.is_some() {
                return Err(invalid("pullRequest"));
            }
        } else {
            let Some(number) = request.environment.strip_prefix("preview-pr-") else {
                return Err(invalid("environment"));
            };
            if !(1..=9).contains(&number.len())
                || number.starts_with('0')
                || !number.bytes().all(|byte| byte.is_ascii_digit())
            {
                return Err(invalid("environment"));
            }
            if number.parse::<u32>().ok() != request.pull_request {
                return Err(invalid("pullRequest"));
            }
        }
        Ok(request)
    }

    pub(super) fn verify_revision(&self, compiled: &str) -> Result<()> {
        if compiled == "development" {
            return Ok(());
        }
        require("build revision", compiled, &self.revision)
    }
}

fn invalid(field: &'static str) -> Error {
    Error::internal(Failure::InvalidRequest { field })
}

fn nullable_pull_request<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> result::Result<Option<u32>, D::Error> {
    Option::<u32>::deserialize(deserializer)
}

#[cfg(test)]
#[path = "_tests_/request_tests.rs"]
mod tests;
