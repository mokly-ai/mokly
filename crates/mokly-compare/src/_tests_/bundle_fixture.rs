//! Small typed recipes shared by pure codec and mocked store tests.

use std::sync::Arc;

use mokly_sidecar::compiled::{CompiledGeneration, RestoreGeneration, ReuseEvidence};
use mokly_sidecar::durable_recipe::DurableRecipe;
use mokly_sidecar::methods::Bundle;
use mokly_sidecar::reusable_recipe::ReusableRecipe;

pub(crate) fn params() -> Bundle {
    Bundle {
        vite: false,
        vite_inputs: None,
        evaluation: Some("evaluation".into()),
        entry_files: vec!["entry.ts".into()],
        renderer: None,
        stories_files: vec![],
        instance_name_props: None,
        module_resolution: Default::default(),
        source_root: "/repo".into(),
        configuration_directory: ".".into(),
        repository_roots: vec![],
    }
}

pub(crate) fn restore() -> RestoreGeneration {
    RestoreGeneration {
        generation: "generation".into(),
        params: params(),
        modules: Default::default(),
        compiled: Arc::new(CompiledGeneration {
            toolchain: "toolchain".into(),
            metadata_identity: None,
            reuse_evidence: Arc::new(ReuseEvidence {
                uncaptured: None,
                durable: true,
                complete: true,
                inputs: Default::default(),
            }),
            unmapped_dependency_directories: None,
            identity: "identity".into(),
            code: "quoted \"code\"\n Unicode é".into(),
            vite: None,
            runtime_key: "runtime".into(),
            dependency_roots: vec![],
            css_modules: vec![],
            sources: Default::default(),
            peers: Default::default(),
            inputs: Default::default(),
            metadata_inputs: Default::default(),
            input_directories: Default::default(),
            metadata_directories: Default::default(),
        }),
    }
}

pub(crate) fn recipe() -> DurableRecipe {
    let value = restore();
    DurableRecipe::new(
        ReusableRecipe::new(
            value.generation,
            value.params,
            value.modules,
            value.compiled,
        )
        .unwrap(),
    )
    .unwrap()
}
