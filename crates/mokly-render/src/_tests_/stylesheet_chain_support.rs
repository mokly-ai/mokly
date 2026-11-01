//! Cumulative module evidence fixtures for stylesheet cache chains.

use std::path::Path;
use std::sync::Arc;

use mokly_css::types::{Bundle, StylesheetRoot};
use mokly_model::material::digest;
use mokly_source_interface::read_evidence::ReadEvidence;
use mokly_source_interface::tree::SourceTree;

use crate::source_paths::SOURCE_INPUT_PREFIX;
use crate::stylesheet_record::ContextEvidence;

use super::stylesheet_support::{bundle, module};

pub(super) fn module_bundle(root: &StylesheetRoot, count: usize) -> Bundle {
    let mut bundle = bundle(root);
    bundle.read_evidence.inputs.retain(|path, _| {
        path.starts_with(SOURCE_INPUT_PREFIX) || (0..count).any(|index| path == &module(index))
    });
    bundle
}

pub(super) fn module_evidence(bundle: &Bundle) -> ReadEvidence {
    let mut evidence = ReadEvidence::default();
    for (path, versions) in &bundle.read_evidence.inputs {
        if !path.starts_with(SOURCE_INPUT_PREFIX) {
            evidence.inputs.insert(path.clone(), versions.clone());
        }
    }
    evidence
}

pub(super) fn full_context_bytes(bundle: &Bundle, tree: &Arc<dyn SourceTree>) -> usize {
    let evidence = module_evidence(bundle);
    ContextEvidence::with_base(
        tree.as_ref(),
        Path::new("/repo"),
        digest(format!("{:?}", evidence.inputs).as_bytes()),
        evidence,
        None,
    )
    .bytes
}
