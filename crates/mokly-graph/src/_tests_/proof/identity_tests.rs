//! Changed source, binding metadata, and policy inputs invalidate Session proofs.

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_model::catalogue::CatalogueModel;
use serde_json::json;

use crate::comparison_proof::{ComparisonRead, ProofMode};
use crate::types::RenderGeneration;

use super::support::{config, session};

fn catalogue() -> PreparedCatalogue {
    PreparedCatalogue { model: CatalogueModel { entries: vec![serde_json::from_value(json!({"metadata":{"path":"sample","title":"Title","description":"","tags":[],"relatedDocs":[],"isIndex":false,"rootIndex":0,"source":{"path":"sample.mockup.ts","line":1,"column":1,"export":"sample"}},"content":{"kind":"page"}})).unwrap()], folders: vec![], sources: vec![], color_schemes: vec![] }, inventory: Default::default(), templates: Default::default(), documents: Default::default(), slot_fragments: Default::default(), elements: Default::default(), prop_validators: Default::default(), javascript: Default::default(), dependency_directories: Default::default(), warnings: vec![] }
}

#[test]
fn session_content_proofs_change_with_source_binding_metadata_and_public_policy() {
    let base = session(config(), catalogue(), "source one");
    for read in [ComparisonRead::Document, ComparisonRead::Closure] {
        let expected = base
            .comparison_identity(read, "sample/index.html", ProofMode::Retained)
            .unwrap();
        let same = session(config(), catalogue(), "source one");
        assert_eq!(
            same.comparison_identity(read, "sample/index.html", ProofMode::Retained),
            Some(expected)
        );
        let source = session(config(), catalogue(), "source two");
        assert_ne!(
            source.comparison_identity(read, "sample/index.html", ProofMode::Retained),
            Some(expected)
        );
        let mut binding = catalogue();
        binding.model.entries[0].metadata.title = "Changed binding title".into();
        let binding = session(config(), binding, "source one");
        assert_ne!(
            binding.comparison_identity(read, "sample/index.html", ProofMode::Retained),
            Some(expected)
        );
        let mut adopted = config();
        adopted.file = "/repo/other.config.json".into();
        let adopted = session(adopted, catalogue(), "source one");
        assert_ne!(
            adopted.comparison_identity(read, "sample/index.html", ProofMode::Retained),
            Some(expected)
        );
        let mut policy = catalogue();
        policy.model.sources.push("new protected input.ts".into());
        let policy = session(config(), policy, "source one");
        assert_ne!(
            policy.comparison_identity(read, "sample/index.html", ProofMode::Retained),
            Some(expected)
        );
    }
    assert_eq!(
        base.comparison_identity(
            ComparisonRead::Resource,
            "static/uncaptured.png",
            ProofMode::Retained
        ),
        None
    );
}
