//! Readers gate format numbers before decoding any payload shape.

use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;
use thiserror::Error;

use crate::detail_validation;
use crate::public_detail::{EntryDetailV1, LiveDescriptorV3};
use crate::public_index::CatalogueReadModel;
use crate::read_contract::ContractViolation;
use crate::review::ReviewResultV8;
use crate::snapshot::CatalogueChangeSnapshotV4;
use crate::{public_validation, versions};
use crate::{review_validation, snapshot_validation};

/// Typed public read failure.
#[derive(Debug, Error)]
pub enum ReadError {
    /// Unsupported or missing format number, checked before payload fields.
    #[error(
        "[mokly-model/version] {boundary} requires schemaVersion {expected}; received {received}", received = version_text(.received)
    )]
    Version {
        /// Versioned boundary name.
        boundary: &'static str,
        /// Supported format number.
        expected: u32,
        /// Supplied version, absent when missing or not an integer.
        received: Option<u64>,
    },
    /// Malformed JSON or current-version structure.
    #[error("[mokly-model/read] invalid {boundary}: {source}")]
    Invalid {
        /// Versioned boundary name.
        boundary: &'static str,
        /// Original decoder error.
        source: serde_json::Error,
    },
    /// A decoded current-version shape violates a relationship contract.
    #[error("[mokly-model/read] invalid {boundary}: {message}")]
    Contract {
        /// Versioned boundary name.
        boundary: &'static str,
        /// Validation detail.
        message: ContractViolation,
    },
}

/// Decode a catalogue index after its v7 gate.
pub fn index(text: &str) -> Result<CatalogueReadModel, ReadError> {
    let index = decode(text, "catalogue index", versions::CATALOGUE_INDEX)?;
    public_validation::validate(&index)?;
    Ok(index)
}

/// Decode an entry detail after its v1 gate.
pub fn detail(text: &str) -> Result<EntryDetailV1, ReadError> {
    let detail: EntryDetailV1 = decode(text, "entry detail", versions::ENTRY_DETAIL)?;
    detail_validation::validate(&detail)?;
    Ok(detail)
}

/// Decode a live descriptor after its v3 gate.
pub fn live(text: &str) -> Result<LiveDescriptorV3, ReadError> {
    let live: LiveDescriptorV3 = decode(text, "live descriptor", versions::LIVE_DESCRIPTOR)?;
    if live.render.url != "/mokly-viewer/components/render" || live.render.token.is_empty() {
        return Err(ReadError::Contract {
            boundary: "live descriptor",
            message: ContractViolation::RenderCapability,
        });
    }
    Ok(live)
}

fn decode<T: DeserializeOwned + Serialize>(
    text: &str,
    boundary: &'static str,
    expected: u32,
) -> Result<T, ReadError> {
    let value: Value = match serde_json::from_str(text) {
        Ok(value) => value,
        Err(source) => return Err(ReadError::Invalid { boundary, source }),
    };
    let received = value.get("schemaVersion").and_then(Value::as_u64);
    if received != Some(u64::from(expected)) {
        return Err(ReadError::Version {
            boundary,
            expected,
            received,
        });
    }
    let decoded: T = match serde_json::from_value(value.clone()) {
        Ok(value) => value,
        Err(source) => return Err(ReadError::Invalid { boundary, source }),
    };
    let encoded = match serde_json::to_value(&decoded) {
        Ok(value) => value,
        Err(source) => return Err(ReadError::Invalid { boundary, source }),
    };
    if !known_fields(&value, &encoded) {
        return Err(ReadError::Contract {
            boundary,
            message: ContractViolation::UnknownField,
        });
    }
    Ok(decoded)
}

#[cfg(test)]
#[path = "_tests_/reader_tests.rs"]
mod reader_tests;

fn known_fields(input: &Value, encoded: &Value) -> bool {
    match (input, encoded) {
        (Value::Object(input), Value::Object(encoded)) => input.iter().all(|(key, value)| {
            encoded
                .get(key)
                .is_some_and(|encoded| known_fields(value, encoded))
        }),
        (Value::Array(input), Value::Array(encoded)) => {
            input.len() == encoded.len()
                && input
                    .iter()
                    .zip(encoded)
                    .all(|(input, encoded)| known_fields(input, encoded))
        }
        _ => true,
    }
}

#[cfg(test)]
#[path = "_tests_/public_reader_tests.rs"]
mod public_reader_tests;

#[cfg(test)]
#[path = "_tests_/public_contract_tests.rs"]
mod public_contract_tests;

fn version_text(received: &Option<u64>) -> String {
    received.map_or_else(
        || "missing or not an integer".into(),
        |number| number.to_string(),
    )
}

/// Decode review v8 after its version gate and strict structural validation.
pub fn review(text: &str) -> Result<ReviewResultV8, ReadError> {
    let result = decode(text, "review result", versions::REVIEW_RESULT)?;
    review_validation::validate(&result)?;
    Ok(result)
}

/// Decode membership snapshot v4 before reading its historical records.
pub fn change_snapshot(text: &str) -> Result<CatalogueChangeSnapshotV4, ReadError> {
    let snapshot = decode(text, "change snapshot", versions::CHANGE_SNAPSHOT)?;
    snapshot_validation::validate(&snapshot)?;
    Ok(snapshot)
}

#[cfg(test)]
#[path = "_tests_/review_reader_tests.rs"]
mod review_reader_tests;

#[cfg(test)]
#[path = "_tests_/snapshot_reader_tests.rs"]
mod snapshot_reader_tests;
