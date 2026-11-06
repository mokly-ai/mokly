//! Readers gate format numbers before decoding any payload shape.

use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;
use thiserror::Error;

use crate::deployment::DeploymentFileV1;
use crate::detail_validation;
use crate::namespace;
use crate::public_detail::{EntryDetailV4, LiveDescriptorV3};
use crate::public_index::CatalogueReadModel;
use crate::public_privacy;
use crate::read_contract::ContractViolation;
use crate::read_decode::value;
use crate::{public_validation, versions};

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

/// Decode a catalogue index after its version gate.
pub fn index(text: &str) -> Result<CatalogueReadModel, ReadError> {
    let index = decode(text, "catalogue index", versions::CATALOGUE_INDEX)?;
    public_validation::validate(&index)?;
    Ok(index)
}

/// Decode a receiver's index, checking its version, content, and public-data privacy.
/// Unknown record fields are ignored, while misplaced union fields remain invalid.
pub fn index_lenient(text: &str) -> Result<CatalogueReadModel, ReadError> {
    let index = decode_with_mode(
        text,
        "catalogue index",
        versions::CATALOGUE_INDEX,
        Mode::Lenient,
    )?;
    public_validation::validate(&index)?;
    Ok(index)
}

/// Decode the static deployment file after its version gate.
pub fn deployment(text: &str) -> Result<DeploymentFileV1, ReadError> {
    let deployment: DeploymentFileV1 = decode(text, "deployment file", versions::DEPLOYMENT_FILE)?;
    if !public_validation::hash(&deployment.deployment_id) {
        return Err(ReadError::Contract {
            boundary: "deployment file",
            message: ContractViolation::Identity,
        });
    }
    Ok(deployment)
}

/// Decode an entry detail after its version gate.
pub fn detail(text: &str) -> Result<EntryDetailV4, ReadError> {
    let detail: EntryDetailV4 = decode(text, "entry detail", versions::ENTRY_DETAIL)?;
    detail_validation::validate(&detail)?;
    Ok(detail)
}

/// Decode a receiver's detail, checking its version, content, and public-data privacy.
/// Unknown record fields are ignored. Contextual usage checks still need an index.
pub fn detail_lenient(text: &str) -> Result<EntryDetailV4, ReadError> {
    let detail = decode_with_mode(text, "entry detail", versions::ENTRY_DETAIL, Mode::Lenient)?;
    detail_validation::validate(&detail)?;
    Ok(detail)
}

/// Decode a live descriptor after its version gate.
pub fn live(text: &str) -> Result<LiveDescriptorV3, ReadError> {
    let live: LiveDescriptorV3 = decode(text, "live descriptor", versions::LIVE_DESCRIPTOR)?;
    if live.render.url != format!("/{}", namespace::viewer("components/render"))
        || live.render.token.is_empty()
    {
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
    decode_with_mode(text, boundary, expected, Mode::Strict)
}

#[derive(PartialEq)]
enum Mode {
    Strict,
    Lenient,
}

fn decode_with_mode<T: DeserializeOwned + Serialize>(
    text: &str,
    boundary: &'static str,
    expected: u32,
    mode: Mode,
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
    if mode == Mode::Lenient {
        public_privacy::validate(&value, boundary)?;
    }
    let decoded: T = match value::from_value(value.clone()) {
        Ok(value) => value,
        Err(source) => return Err(ReadError::Invalid { boundary, source }),
    };
    if mode == Mode::Lenient {
        return Ok(decoded);
    }
    let encoded = serde_json::to_value(&decoded)
        .expect("the four public reader types contain only JSON data and string map keys");
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
#[path = "_tests_/detail_reasons_tests.rs"]
mod detail_reasons_tests;

#[cfg(test)]
#[path = "_tests_/public_contract_tests.rs"]
mod public_contract_tests;

fn version_text(received: &Option<u64>) -> String {
    received.map_or_else(
        || "missing or not an integer".into(),
        |number| number.to_string(),
    )
}

#[cfg(test)]
#[path = "_tests_/comparison_eligibility_tests.rs"]
mod comparison_eligibility_tests;

#[cfg(test)]
#[path = "_tests_/reader_fixtures.rs"]
mod reader_fixtures;

#[cfg(test)]
#[path = "_tests_/reader_lenient_tests.rs"]
mod reader_lenient_tests;

#[cfg(test)]
#[path = "_tests_/reader_union_tests.rs"]
mod reader_union_tests;

#[cfg(test)]
#[path = "_tests_/reader_privacy_tests.rs"]
mod reader_privacy_tests;

#[cfg(test)]
#[path = "_tests_/reader_null_tests.rs"]
mod reader_null_tests;
