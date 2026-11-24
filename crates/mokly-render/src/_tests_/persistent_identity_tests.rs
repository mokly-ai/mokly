//! Optional identity accepts only complete durable evidence and ignores whole-bundle epochs.

use std::sync::Arc;

use mokly_sidecar::compiled::{CompiledGeneration, ReuseEvidence, UncapturedEvidence};

use super::compilation;

#[test]
fn persistent_compilation_identity_requires_stable_metadata_and_toolchain_only() {
    let mut input = CompiledGeneration {
        vite: None,
        toolchain: "toolchain-A".into(),
        metadata_identity: Some("metadata-A".into()),
        reuse_evidence: Arc::new(ReuseEvidence {
            complete: true,
            durable: true,
            uncaptured: None,
            inputs: Default::default(),
        }),
        identity: "bundle-A".into(),
        code: "program-A".into(),
        runtime_key: "epoch-A".into(),
        dependency_roots: vec![],
        css_modules: vec![],
        sources: Default::default(),
        peers: Default::default(),
        inputs: Default::default(),
        metadata_inputs: Default::default(),
        input_directories: Default::default(),
        metadata_directories: Default::default(),
        unmapped_dependency_directories: None,
    };
    let original = compilation(&input).unwrap();
    input.identity = "unrelated-bundle-edit".into();
    input.code = "program-B".into();
    input.runtime_key = "epoch-B".into();
    assert_eq!(compilation(&input), Some(original.clone()));
    input.toolchain = "toolchain-B".into();
    assert_ne!(compilation(&input), Some(original));
    for (complete, durable, uncaptured, metadata) in [
        (false, true, None, Some("metadata-A")),
        (true, false, None, Some("metadata-A")),
        (
            false,
            false,
            Some(UncapturedEvidence::ServeEdit),
            Some("metadata-A"),
        ),
        (true, true, None, None),
        (true, true, None, Some("")),
    ] {
        input.reuse_evidence = Arc::new(ReuseEvidence {
            complete,
            durable,
            uncaptured,
            inputs: Default::default(),
        });
        input.metadata_identity = metadata.map(str::to_owned);
        assert_eq!(compilation(&input), None);
    }
}
