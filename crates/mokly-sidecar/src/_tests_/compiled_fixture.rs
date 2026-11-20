//! Complete immutable recipes for pool boundary fixtures.

use std::collections::BTreeMap;
use std::sync::Arc;

use crate::compiled::{CompiledGeneration, ReuseEvidence};

pub(crate) fn compiled(identity: &str) -> CompiledGeneration {
    CompiledGeneration {
        toolchain: "fixture".into(),
        metadata_identity: None,
        reuse_evidence: Arc::new(ReuseEvidence {
            uncaptured: None,
            durable: true,
            complete: true,
            inputs: Default::default(),
        }),
        identity: identity.into(),
        code: "module.exports={}".into(),
        vite: None,
        runtime_key: "fixture-runtime".into(),
        dependency_roots: Vec::new(),
        css_modules: Vec::new(),
        sources: BTreeMap::new(),
        peers: BTreeMap::new(),
        inputs: BTreeMap::new(),
        metadata_inputs: BTreeMap::new(),
        input_directories: BTreeMap::new(),
        metadata_directories: BTreeMap::new(),
        unmapped_dependency_directories: None,
    }
}
