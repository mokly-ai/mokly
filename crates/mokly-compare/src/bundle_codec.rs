//! Versioned, typed bundle files with independent file and seed-frame bounds.

use std::io::{self, Write};
use std::sync::Arc;

use mokly_sidecar::codec::MAX_FRAME_BYTES;
use mokly_sidecar::compiled::{CompiledGeneration, RestoreGeneration};
use mokly_sidecar::methods::Bundle;
use mokly_sidecar::resolution_plan::ResolutionPlan;
use mokly_sidecar::results::Module;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::{InternalError, Result};

pub(crate) const HEADER_BYTES: usize = 1024;

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Header {
    pub(crate) format_version: u64,
    pub(crate) mokly_version: String,
    pub(crate) payload_digest: String,
}

#[derive(Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum StoredKind {
    Bundles,
    Sources,
    Dependencies,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct StoredBundle<T> {
    pub(crate) kind: StoredKind,
    pub(crate) recipe: T,
}

#[derive(Serialize)]
pub(crate) struct StoredRecipe<'a> {
    pub(crate) generation: &'a str,
    pub(crate) params: &'a Bundle,
    pub(crate) modules: &'a [Module],
    pub(crate) compiled: &'a CompiledGeneration,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) plan: Option<&'a ResolutionPlan>,
}

#[derive(Deserialize)]
pub(crate) struct StoredGeneration {
    #[serde(flatten)]
    pub(crate) restore: RestoreGeneration,
    #[serde(default)]
    pub(crate) plan: Option<Arc<ResolutionPlan>>,
}

/// Internal bounds are explicit so each independent byte rule has a small test.
pub(crate) struct Codec {
    pub(crate) file_bytes: usize,
    pub(crate) frame_bytes: usize,
}

impl Default for Codec {
    fn default() -> Self {
        Self {
            file_bytes: MAX_FRAME_BYTES,
            frame_bytes: MAX_FRAME_BYTES,
        }
    }
}

pub(crate) type Payload = StoredBundle<StoredGeneration>;

pub(crate) fn same_settings(left: &Bundle, right: &Bundle) -> bool {
    let mut params = left.clone();
    params.evaluation = right.evaluation.clone();
    params == *right
}

pub(crate) fn settings_key(params: &Bundle) -> Result<String> {
    let mut params = params.clone();
    params.evaluation = None;
    let mut writer = DigestWriter(Sha256::new());
    if let Err(source) = serde_json::to_writer(&mut writer, &params) {
        return Err(InternalError::Json { source }.into());
    }
    Ok(hex(&writer.0.finalize()))
}

pub(crate) fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub(crate) fn compilation_digest(runtime_key: &str) -> [u8; 32] {
    Sha256::digest(runtime_key.as_bytes()).into()
}

struct DigestWriter(Sha256);

impl Write for DigestWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0.update(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/bundle_codec_tests.rs"]
mod bundle_codec_tests;

#[cfg(test)]
#[path = "_tests_/bundle_plan_codec_tests.rs"]
mod bundle_plan_codec_tests;
