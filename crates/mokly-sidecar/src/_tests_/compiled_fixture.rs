//! Complete immutable recipes for pool boundary fixtures.

use std::collections::BTreeMap;

use crate::compiled::CompiledGeneration;

pub(crate) fn compiled(identity: &str) -> CompiledGeneration {
    CompiledGeneration {
        identity: identity.into(),
        code: "module.exports={}".into(),
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
