//! Typed corpus operations and documented cloud rejection metadata.

use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Corpus {
    pub(crate) schema_version: u64,
    pub(crate) mokly_version: String,
    pub(crate) viewer_version: String,
    pub(crate) base_document: Value,
    pub(crate) cases: Vec<Case>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Case {
    pub(crate) name: String,
    pub(crate) counts: Option<Counts>,
    pub(crate) patch: Option<Vec<Operation>>,
    pub(crate) raw_document: Option<String>,
    pub(crate) document_sha256: String,
    pub(crate) cloud_rejection: Option<Rejection>,
    pub(crate) viewer_valid: Option<bool>,
}

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum Operation {
    Set { path: String, value: Value },
    Remove { path: String },
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum Rejection {
    Invalid,
    UnsupportedVersion,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Counts {
    pub(crate) changed: u64,
    pub(crate) added: u64,
    pub(crate) removed: u64,
    pub(crate) moved: u64,
}
