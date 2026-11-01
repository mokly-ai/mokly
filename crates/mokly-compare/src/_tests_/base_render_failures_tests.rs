//! Each base failure retains the scripts mode from historical preparation.

use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_git::identity::ObjectId;
use mokly_graph::types::RenderGeneration;
use unimock::{MockFn, Unimock, matching};

use crate::base_render::{
    BasePreparationError, BasePreparationResult, BaseProviderMock, BaseSourceFactoryMock, Changes,
    ChangesService, HistoricalSources, PreparedBase,
};
use crate::base_selection::PinnedBase;
use crate::comparison_steps::StepsMock;
use crate::comparison_types::{ComparisonMock, ComparisonResult};
use crate::error::{Error, Result};
use crate::source_failures::SourceFailuresMock;

fn generation() -> Arc<dyn RenderGeneration> {
    Arc::new(Unimock::new(()))
}

fn prepared() -> BasePreparationResult {
    Ok(PreparedBase {
        generation: generation(),
        scripts_off: true,
    })
}

fn classify(
    prepared: BasePreparationResult,
    failures: Unimock,
    comparison: Unimock,
) -> Result<ComparisonResult> {
    let service: &dyn ChangesService = &Changes {
        lookup: Arc::new(Unimock::new(())),
        pinned: Some(Arc::new(PinnedBase {
            reference: "selected".into(),
            commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
            repository: Arc::new(Unimock::new(())),
        })),
        sources: Arc::new(Unimock::new(
            BaseSourceFactoryMock::create
                .next_call(matching!(_))
                .returns(Ok(HistoricalSources {
                    failures: Arc::new(failures),
                    tree: Arc::new(Unimock::new(())),
                    sources: Arc::new(Unimock::new(())),
                })),
        )),
        provider: Arc::new(Unimock::new(
            BaseProviderMock::prepare
                .next_call(matching!(_))
                .returns(prepared),
        )),
        comparison: Arc::new(comparison),
        steps: Arc::new(Unimock::new(
            StepsMock::step.each_call(matching!(_)).returns(()),
        )),
    };
    let config = ResolvedConfig {
        input: Config::default(),
        repo_root: "/repo".into(),
        file: "/repo/mokly.config.json".into(),
        roots: Vec::new(),
        authored_inputs: Vec::new(),
    };
    service.classify(&config, None, generation(), None)
}

fn assert_source_failure(error: Error, expected: &Arc<Error>) {
    assert!(
        matches!(error, Error::Base { commit, scripts_off: true, source }
            if commit == "a".repeat(40)
                && matches!(source.as_ref(), Error::SourceFailure { source } if Arc::ptr_eq(source, expected))
        )
    );
}

#[test]
fn preparation_error_message_has_the_base_module_prefix() {
    let error = BasePreparationError::new(true, Error::Cancelled);
    assert_eq!(
        error.to_string(),
        "[mokly-compare/base] [mokly-compare/base] preparation cancelled"
    );
}

#[test]
fn source_failure_after_preparation_keeps_scripts_off_from_either_result() {
    for prepared in [
        prepared(),
        Err(BasePreparationError::new(true, Error::Cancelled)),
    ] {
        let source = Arc::new(Error::UnsupportedManager);
        let failures = Unimock::new(
            SourceFailuresMock::failure
                .next_call(matching!())
                .returns(Some(source.clone())),
        );
        assert_source_failure(
            classify(prepared, failures, Unimock::new(())).unwrap_err(),
            &source,
        );
    }
}

#[test]
fn preparation_failure_keeps_scripts_off_and_its_typed_source() {
    let failures = Unimock::new(
        SourceFailuresMock::failure
            .next_call(matching!())
            .returns(None),
    );
    let error = classify(
        Err(BasePreparationError::new(true, Error::Cancelled)),
        failures,
        Unimock::new(()),
    )
    .unwrap_err();
    assert!(
        matches!(error, Error::Base { commit, scripts_off: true, source }
            if commit == "a".repeat(40) && matches!(*source, Error::Cancelled)
        )
    );
}

#[test]
fn source_failure_after_capture_failure_keeps_scripts_off() {
    let source = Arc::new(Error::UnsupportedManager);
    let failures = Unimock::new((
        SourceFailuresMock::failure
            .next_call(matching!())
            .returns(None),
        SourceFailuresMock::failure
            .next_call(matching!())
            .returns(Some(source.clone())),
    ));
    let comparison = Unimock::new(
        ComparisonMock::capture_base
            .next_call(matching!(_))
            .returns(Err(Error::Cancelled)),
    );
    assert_source_failure(
        classify(prepared(), failures, comparison).unwrap_err(),
        &source,
    );
}

#[test]
fn source_failure_after_comparison_keeps_scripts_off() {
    let source = Arc::new(Error::UnsupportedManager);
    let failures = Unimock::new((
        SourceFailuresMock::failure
            .next_call(matching!())
            .returns(None),
        SourceFailuresMock::failure
            .next_call(matching!())
            .returns(Some(source.clone())),
    ));
    let comparison = Unimock::new((
        ComparisonMock::capture_base
            .next_call(matching!(_))
            .returns(Ok(generation())),
        ComparisonMock::compare_prepared
            .next_call(matching!(_))
            .returns(Err(Error::Cancelled)),
    ));
    assert_source_failure(
        classify(prepared(), failures, comparison).unwrap_err(),
        &source,
    );
}
