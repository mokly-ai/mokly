//! Scripted preparation and checkpoint events exercise the public classification service.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_git::identity::ObjectId;
use unimock::{MockFn, Unimock, matching};

use crate::base_render::{
    BasePreparationError, BaseProviderMock, BaseSourceFactoryMock, Changes, ChangesService,
    HistoricalSources, PreparationCheckpoint, PreparedBase,
};
use crate::base_selection::PinnedBase;
use crate::comparison_steps::StepsMock;
use crate::comparison_types::{ComparisonMock, ComparisonResult};
use crate::error::{Error, Result};
use crate::source_failures::SourceFailuresMock;

#[derive(Clone, Copy, Debug)]
pub(super) enum Outcome {
    Prepared,
    PreparationFailure,
    CaptureFailure,
}

/// Every optional scripted operation is asserted through the returned event list.
pub(super) fn classify(
    outcome: Outcome,
    stale: bool,
) -> (Result<ComparisonResult>, Vec<&'static str>) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let attempts = Arc::new(AtomicUsize::new(0));
    let provider = Unimock::new((
        BaseProviderMock::prepare
            .each_call(matching!(_))
            .answers_arc({
                let attempts = attempts.clone();
                let events = events.clone();
                Arc::new(move |_, _| {
                    events.lock().unwrap().push("prepare");
                    attempts.fetch_add(1, Ordering::SeqCst);
                    match outcome {
                        Outcome::PreparationFailure => {
                            Err(BasePreparationError::new(true, Error::UnsupportedVersion))
                        }
                        _ => Ok(PreparedBase {
                            generation: Arc::new(Unimock::new(())),
                            scripts_off: true,
                            freshness: None,
                        }),
                    }
                })
            }),
        BaseProviderMock::checkpoint
            .each_call(matching!(_, _))
            .answers_arc({
                let events = events.clone();
                let attempts = attempts.clone();
                Arc::new(move |_, _, checkpoint| {
                    events.lock().unwrap().push(match checkpoint {
                        PreparationCheckpoint::Capture => "capture-check",
                        PreparationCheckpoint::Complete => "complete-check",
                    });
                    Ok(!stale || attempts.load(Ordering::SeqCst) > 1)
                })
            }),
        BaseProviderMock::restarting
            .each_call(matching!())
            .answers_arc({
                let events = events.clone();
                Arc::new(move |_| events.lock().unwrap().push("restart"))
            }),
        BaseProviderMock::keep
            .each_call(matching!(_, _))
            .answers_arc({
                let events = events.clone();
                Arc::new(move |_, _, _| {
                    events.lock().unwrap().push("keep");
                    Ok(None)
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
                    match outcome {
                        Outcome::CaptureFailure => Err(Error::YarnPnp),
                        _ => Ok(generation),
                    }
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
    let failures = Arc::new(Unimock::new(
        SourceFailuresMock::failure
            .each_call(matching!())
            .answers(&|_| None),
    ));
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
    let result = changes.classify(
        &ResolvedConfig {
            input: Config::default(),
            repo_root: "/repo".into(),
            file: "/repo/mokly.config.json".into(),
            roots: Vec::new(),
            authored_inputs: Vec::new(),
        },
        None,
        Arc::new(Unimock::new(())),
        None,
    );
    let events = events.lock().unwrap().clone();
    (result, events)
}
