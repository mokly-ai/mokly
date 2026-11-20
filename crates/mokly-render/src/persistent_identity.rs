//! Only stable captured compilation metadata can identify persistent documents.

use mokly_model::material::digest;
use mokly_sidecar::compiled::CompiledGeneration;

pub(crate) fn compilation(compiled: &CompiledGeneration) -> Option<String> {
    if !compiled.reuse_evidence.captured()
        || !compiled.reuse_evidence.durable
        || compiled.toolchain.is_empty()
    {
        return None;
    }
    let metadata = compiled
        .metadata_identity
        .as_deref()
        .filter(|identity| !identity.is_empty())?;
    Some(digest(
        format!(
            "{}:{}{metadata}",
            compiled.toolchain.len(),
            compiled.toolchain
        )
        .as_bytes(),
    ))
}

#[cfg(test)]
#[path = "_tests_/persistent_identity_tests.rs"]
mod persistent_identity_tests;
