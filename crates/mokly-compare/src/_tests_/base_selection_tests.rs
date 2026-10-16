//! A pinned base retains its sole lookup across current rendering and comparison.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_git::identity::ObjectId;
use mokly_git::repository::{RepositoriesMock, Repository, RepositoryMock};
use mokly_graph::types::{RenderGeneration, RenderGenerationMock, RenderSummary};
use unimock::{MockFn, Unimock, matching};

use crate::base_render::{
    BaseProviderMock, BaseSourceFactoryMock, Changes, ChangesService, HistoricalSources,
};
use crate::base_selection::{BaseLookup, GitBaseLookup};
use crate::comparison_types::ComparisonMock;
use crate::error::Error;
use crate::source_failures::SourceFailuresMock;

#[test]
fn pin_resolves_once_and_classification_uses_its_reference_and_commit() {
    let commit = ObjectId::parse(&"a".repeat(40)).unwrap();
    let repository: Arc<dyn Repository> = Arc::new(Unimock::new(
        RepositoryMock::merge_base
            .next_call(matching!("selected"))
            .returns(Ok(commit.clone())),
    ));
    let lookup: &dyn BaseLookup = &GitBaseLookup {
        repositories: Arc::new(Unimock::new(
            RepositoriesMock::open
                .next_call(matching!(_))
                .returns(Ok(repository)),
        )),
    };
    let pinned = lookup.pin(Path::new("/repo"), "selected").unwrap();
    let before: Arc<dyn RenderGeneration> = Arc::new(Unimock::new(
        RenderGenerationMock::render_all
            .next_call(matching!())
            .returns(Ok(RenderSummary::default())),
    ));
    let failures = Arc::new(Unimock::new(
        SourceFailuresMock::failure
            .each_call(matching!())
            .returns(None)
            .n_times(2),
    ));
    let service: &dyn ChangesService = &Changes {
        lookup: Arc::new(Unimock::new(())), pinned: Some(pinned),
        sources: Arc::new(Unimock::new(BaseSourceFactoryMock::create.next_call(matching!((_, commit, _) if commit.as_str() == "a".repeat(40))).returns(Ok(HistoricalSources { failures, tree: Arc::new(Unimock::new(())), sources: Arc::new(Unimock::new(())) })))),
        provider: Arc::new(Unimock::new(BaseProviderMock::prepare.next_call(matching!((request) if request.commit.as_str() == "a".repeat(40))).returns(Ok(before)))),
        comparison: Arc::new(Unimock::new(ComparisonMock::compare.next_call(matching!((request, _, _) if request.base_ref == "selected" && request.base_commit == "a".repeat(40))).returns(Err(Error::UnsupportedManager)))),
    };
    let config = ResolvedConfig {
        input: Config::default(),
        repo_root: "/repo".into(),
        file: "/repo/mokly.config.json".into(),
        roots: vec![],
        authored_inputs: vec![],
    };
    assert!(matches!(
        service.classify(&config, Some("changed-ref"), Arc::new(Unimock::new(()))),
        Err(Error::UnsupportedManager)
    ));
}
