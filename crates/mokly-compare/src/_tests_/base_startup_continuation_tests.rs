//! Startup outcomes continue once; retained markers still require current evidence.

use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_git::identity::ObjectId;
use unimock::{MockFn, Unimock, matching};

use crate::base_render::{
    BaseProviderMock, BaseSourceFactoryMock, Changes, ChangesService, HistoricalSources,
    PreparedBase,
};
use crate::base_retention::KeptBase;
use crate::base_selection::PinnedBase;
use crate::base_startup::PreparedOutcome;
use crate::comparison_steps::StepsMock;
use crate::comparison_types::ComparisonMock;
use crate::error::Error;
use crate::source_failures::SourceFailuresMock;

#[derive(Clone, Copy)]
enum Outcome {
    Captured,
    Retained,
    Failed,
}

fn continue_twice(outcome: Outcome) -> (Vec<&'static str>, bool) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let failures = Arc::new(Unimock::new(
        SourceFailuresMock::failure
            .each_call(matching!())
            .returns(None),
    ));
    let generation = Arc::new(Unimock::new(()));
    let captured = Arc::new(KeptBase {
        generation: generation.clone(),
        failures: failures.clone(),
        scripts_off: true,
        freshness: None,
    });
    let ready = Arc::new(Mutex::new(Some(match outcome {
        Outcome::Captured => Ok(PreparedOutcome::Captured(captured)),
        Outcome::Retained => Ok(PreparedOutcome::Retained),
        Outcome::Failed => Err(Error::Base {
            commit: "a".repeat(40),
            scripts_off: true,
            source: Box::new(Error::UnsupportedVersion),
        }),
    })));
    let provider = Unimock::new((
        BaseProviderMock::take_prepared
            .each_call(matching!(_))
            .answers_arc({
                let events = events.clone();
                let ready = ready.clone();
                Arc::new(move |_, _| {
                    events.lock().unwrap().push("take");
                    ready.lock().unwrap().take().transpose()
                })
            }),
        BaseProviderMock::find_kept
            .each_call(matching!(_))
            .answers_arc({
                let events = events.clone();
                Arc::new(move |_, _| {
                    events.lock().unwrap().push("freshness");
                    Ok(None)
                })
            }),
        BaseProviderMock::prepare
            .each_call(matching!(_))
            .answers_arc({
                let events = events.clone();
                let generation = generation.clone();
                Arc::new(move |_, _| {
                    events.lock().unwrap().push("prepare");
                    Ok(PreparedBase {
                        generation: generation.clone(),
                        scripts_off: false,
                        freshness: None,
                    })
                })
            }),
    ))
    .no_verify_in_drop();
    let comparison = Unimock::new((
        ComparisonMock::capture_base
            .each_call(matching!(_))
            .answers_arc({
                let events = events.clone();
                Arc::new(move |_, generation| {
                    events.lock().unwrap().push("capture");
                    Ok(generation)
                })
            }),
        ComparisonMock::compare_prepared
            .each_call(matching!(_, _, _))
            .answers_arc({
                let events = events.clone();
                Arc::new(move |_, _, _, _| {
                    events.lock().unwrap().push("compare");
                    Err(Error::UnsupportedManager)
                })
            }),
    ))
    .no_verify_in_drop();
    let changes: &dyn ChangesService = &Changes {
        lookup: Arc::new(Unimock::new(())),
        pinned: Some(Arc::new(PinnedBase {
            reference: "main".into(),
            commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
            repository: Arc::new(Unimock::new(())),
        })),
        sources: Arc::new(Unimock::new(
            BaseSourceFactoryMock::create
                .each_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, _, _, _| {
                    Ok(HistoricalSources {
                        failures: failures.clone(),
                        tree: Arc::new(Unimock::new(())),
                        sources: Arc::new(Unimock::new(())),
                    })
                })),
        )),
        provider: Arc::new(provider),
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
    let first = changes.classify(&config, None, generation.clone(), None);
    let typed = matches!(first, Err(Error::Base { commit, scripts_off: true, source })
        if commit == "a".repeat(40) && matches!(*source, Error::UnsupportedVersion));
    let _second = changes.classify(&config, None, generation, None);
    let events = events.lock().unwrap().clone();
    (events, typed)
}

#[test]
fn an_unkept_startup_capture_compares_once_without_a_second_capture() {
    let (events, _) = continue_twice(Outcome::Captured);
    assert_eq!(
        events,
        [
            "take",
            "compare",
            "take",
            "freshness",
            "prepare",
            "capture",
            "compare"
        ]
    );
}

#[test]
fn a_retained_marker_cannot_bypass_an_ordinary_freshness_miss() {
    let (events, _) = continue_twice(Outcome::Retained);
    assert_eq!(
        events,
        [
            "take",
            "freshness",
            "prepare",
            "capture",
            "compare",
            "take",
            "freshness",
            "prepare",
            "capture",
            "compare"
        ]
    );
}

#[test]
fn a_keyed_startup_error_preserves_its_type_and_scripts_setting_once() {
    let (events, typed) = continue_twice(Outcome::Failed);
    assert!(typed);
    assert_eq!(
        events,
        ["take", "take", "freshness", "prepare", "capture", "compare"]
    );
}
