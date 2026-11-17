//! Literal dependency and generation fixtures with strict IO mocks.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_catalogue::render_sources::{JavaScriptCatalogue, JavaScriptGeneration};
use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::{Repository, RepositoryMock};
use mokly_git::source_key::CheckoutIdentity;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::catalogue::CatalogueModel;
use unimock::{MockFn, Unimock, matching};

use crate::base_freshness::DependencySelection;
use crate::base_selection::PinnedBase;
use crate::inputs::Inputs;

pub(super) fn checkout() -> CheckoutIdentity {
    CheckoutIdentity {
        digest: "original-checkout".into(),
        filtered: false,
    }
}

pub(super) fn inputs(bytes: &[u8]) -> Inputs {
    Inputs {
        files: BTreeMap::from([(
            RepoPath::parse("package-lock.json").unwrap(),
            bytes.to_vec(),
        )]),
        objects: BTreeMap::new(),
    }
}

pub(super) fn selection() -> DependencySelection {
    DependencySelection {
        inputs: inputs(b"original lock"),
        paths: None,
        directories: vec!["node_modules".into()],
        unmapped: Vec::new(),
    }
}

pub(super) fn catalogue(modules: &[(&str, Option<&str>)]) -> PreparedCatalogue {
    PreparedCatalogue {
        model: CatalogueModel {
            entries: Vec::new(),
            folders: Vec::new(),
            sources: Vec::new(),
            color_schemes: Vec::new(),
        },
        inventory: Default::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        prop_validators: Default::default(),
        javascript: JavaScriptCatalogue {
            generation: Some(JavaScriptGeneration {
                module_digests: modules
                    .iter()
                    .map(|(path, digest)| (String::from(*path), digest.map(String::from)))
                    .collect(),
                ..Default::default()
            }),
            ..Default::default()
        },
        dependency_directories: Default::default(),
        warnings: Vec::new(),
    }
}

pub(super) fn generation(modules: &[(&str, Option<&str>)]) -> Unimock {
    Unimock::new(
        RenderGenerationMock::catalogue
            .some_call(matching!())
            .returns(catalogue(modules)),
    )
}

pub(super) fn pinned(identity: CheckoutIdentity) -> PinnedBase {
    let repository: Arc<dyn Repository> = Arc::new(Unimock::new(
        RepositoryMock::checkout_identity
            .some_call(matching!(_))
            .returns(Ok(identity)),
    ));
    PinnedBase {
        repository,
        reference: "main".into(),
        commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
    }
}
