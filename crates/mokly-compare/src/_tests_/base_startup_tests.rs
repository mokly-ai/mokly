//! Base-only preparation captures once and preserves typed preparation failures.

use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_git::identity::ObjectId;
use unimock::{MockFn, Unimock, matching};

use crate::base_render::{
    BasePreparationError, BaseProviderMock, BaseSourceFactoryMock, Changes, HistoricalSources,
    PreparedBase,
};
use crate::base_retention::BaseRetentionRequest;
use crate::base_selection::PinnedBase;
use crate::base_startup::{BasePreparation, PreparedOutcome};
use crate::comparison_types::ComparisonMock;
use crate::error::{Error, Result};
use crate::source_failures::SourceFailuresMock;

fn prepare(success: bool) -> (Result<PreparedOutcome>, Vec<Unimock>) {
    let generation = Arc::new(Unimock::new(()));
    let sources = Unimock::new(
        BaseSourceFactoryMock::create
            .some_call(matching!(_, _, _))
            .returns(Ok(HistoricalSources {
                failures: Arc::new(Unimock::new(
                    SourceFailuresMock::failure
                        .each_call(matching!())
                        .returns(None),
                )),
                tree: Arc::new(Unimock::new(())),
                sources: Arc::new(Unimock::new(())),
            })),
    );
    let provider = Unimock::new(BaseProviderMock::prepare.some_call(matching!(_)).returns(
        if success {
            Ok(PreparedBase {
                generation: generation.clone(),
                scripts_off: true,
                freshness: None,
            })
        } else {
            Err(BasePreparationError::new(true, Error::UnsupportedManager))
        },
    ));
    let comparison = if success {
        Unimock::new(
            ComparisonMock::capture_base
                .some_call(matching!(_))
                .answers(&|_, before| Ok(before)),
        )
    } else {
        Unimock::new(())
    };
    let service: &dyn BasePreparation = &Changes {
        lookup: Arc::new(Unimock::new(())),
        pinned: None,
        sources: Arc::new(sources.clone()),
        provider: Arc::new(provider.clone()),
        comparison: Arc::new(comparison.clone()),
        steps: Arc::new(Unimock::new(())),
    };
    let selected = PinnedBase {
        reference: "origin/main".into(),
        repository: Arc::new(Unimock::new(())),
        commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
    };
    let config = ResolvedConfig {
        input: Config::default(),
        repo_root: "/repo".into(),
        file: "/repo/mokly.config.json".into(),
        roots: Vec::new(),
        authored_inputs: Vec::new(),
    };
    let result = service.prepare_base(&BaseRetentionRequest {
        selected: &selected,
        working_config: &config,
        head: generation.as_ref(),
        install_scripts: false,
    });
    (result, vec![sources, provider, comparison])
}

#[test]
fn base_only_preparation_captures_once_without_comparing() {
    let (result, _checks) = prepare(true);
    assert!(matches!(result, Ok(PreparedOutcome::Captured(base)) if base.scripts_off));
}

#[test]
fn base_only_failure_preserves_the_typed_error_and_scripts_mode() {
    let (result, _checks) = prepare(false);
    assert!(
        matches!(result, Err(Error::Base { commit, scripts_off: true, source })
        if commit == "a".repeat(40) && matches!(*source, Error::UnsupportedManager))
    );
}
