//! Changes reads before base preparation and compares only after the base capture.

use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_git::identity::ObjectId;
use unimock::{MockFn, Unimock, matching};

use crate::base_render::{
    BaseProviderMock, BaseSourceFactoryMock, Changes, ChangesService, HistoricalSources,
};
use crate::base_selection::PinnedBase;
use crate::comparison_steps::{Step, StepsMock};
use crate::comparison_types::ComparisonMock;
use crate::error::Error;
use crate::source_failures::SourceFailuresMock;

#[test]
fn reading_starts_before_base_preparation_and_comparing_after_the_base_capture() {
    let boundaries = Unimock::new((
        StepsMock::step
            .next_call(matching!(Step::Reading))
            .returns(()),
        BaseSourceFactoryMock::create
            .next_call(matching!(_, _, _))
            .answers(&|boundaries, _, _, _| {
                Ok(HistoricalSources {
                    failures: Arc::new(boundaries.clone()),
                    tree: Arc::new(boundaries.clone()),
                    sources: Arc::new(boundaries.clone()),
                })
            }),
        BaseProviderMock::prepare
            .next_call(matching!(_))
            .answers(&|boundaries, _| Ok(Arc::new(boundaries.clone()))),
        SourceFailuresMock::failure
            .next_call(matching!())
            .returns(None),
        ComparisonMock::capture_base
            .next_call(matching!(_))
            .answers(&|_, before| Ok(before)),
        StepsMock::step
            .next_call(matching!(Step::Comparing))
            .returns(()),
        ComparisonMock::compare_prepared
            .next_call(matching!(_, _, _))
            .returns(Err(Error::UnsupportedManager)),
        SourceFailuresMock::failure
            .next_call(matching!())
            .returns(None),
    ));
    let service: &dyn ChangesService = &Changes {
        lookup: Arc::new(Unimock::new(())),
        pinned: Some(Arc::new(PinnedBase {
            reference: "origin/main".into(),
            repository: Arc::new(Unimock::new(())),
            commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
        })),
        sources: Arc::new(boundaries.clone()),
        provider: Arc::new(boundaries.clone()),
        comparison: Arc::new(boundaries.clone()),
        steps: Arc::new(boundaries),
    };
    let config = ResolvedConfig {
        input: Config::default(),
        repo_root: "/repo".into(),
        file: "/repo/mokly.config.json".into(),
        roots: vec![],
        authored_inputs: vec![],
    };
    assert!(matches!(
        service.classify(&config, None, Arc::new(Unimock::new(())), None),
        Err(Error::UnsupportedManager)
    ));
}
