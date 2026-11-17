//! Strict provider mocks expose retention and classification operation counts.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, Weak};

use mokly_git::control::{Cancellation, CancellationMock};
use mokly_git::identity::ObjectId;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use unimock::{MockFn, Unimock, matching};

use crate::base_render::{
    BaseProviderMock, BaseSourceFactoryMock, Changes, ChangesService, HistoricalSources,
    PreparedBase,
};
use crate::base_retention::{BaseReuse, KeptBase};
use crate::base_selection::PinnedBase;
use crate::comparison_error::CompareResult;
use crate::comparison_steps::{Step, StepsMock};
use crate::comparison_types::{ComparisonMock, ComparisonResult};
use crate::error::Result;
use crate::source_failures::SourceFailures;

use super::support::{config, provider_error, result};

#[derive(Default)]
pub(super) struct State {
    pub(super) slot: Option<Arc<KeptBase>>,
    pub(super) sources: usize,
    pub(super) prepares: usize,
    pub(super) captures: usize,
    pub(super) keeps: usize,
    pub(super) releases: usize,
    pub(super) comparisons: usize,
    pub(super) retired: Option<Weak<dyn RenderGeneration>>,
    pub(super) alive_at_prepare: usize,
    pub(super) steps: Vec<Step>,
}

pub(super) struct Harness {
    pub(super) changes: Changes,
    pub(super) state: Arc<Mutex<State>>,
    pub(super) cancelled: Arc<AtomicBool>,
    pub(super) head_failure: Arc<AtomicBool>,
}

impl Harness {
    pub(super) fn new(
        initial: Option<Arc<KeptBase>>,
        fresh: Option<(Arc<dyn RenderGeneration>, Arc<dyn SourceFailures>)>,
        compares: bool,
    ) -> Self {
        let state = Arc::new(Mutex::new(State {
            slot: initial,
            ..State::default()
        }));
        let cancelled = Arc::new(AtomicBool::new(false));
        let cancellation: Arc<dyn Cancellation> = Arc::new(if compares {
            Unimock::new(
                CancellationMock::cancelled
                    .each_call(matching!())
                    .answers_arc({
                        let cancelled = cancelled.clone();
                        Arc::new(move |_| cancelled.load(Ordering::Acquire))
                    }),
            )
        } else {
            Unimock::new(())
        });
        let sources = Arc::new(if let Some((_, failures)) = &fresh {
            Unimock::new(
                BaseSourceFactoryMock::create
                    .each_call(matching!(_))
                    .answers_arc({
                        let state = state.clone();
                        let failures = failures.clone();
                        Arc::new(move |_, _, _, _| {
                            state.lock().unwrap().sources += 1;
                            Ok(HistoricalSources {
                                failures: failures.clone(),
                                tree: Arc::new(Unimock::new(())),
                                sources: Arc::new(Unimock::new(())),
                            })
                        })
                    }),
            )
        } else {
            Unimock::new(())
        });
        let retention = (
            BaseProviderMock::find_kept
                .each_call(matching!(_))
                .answers_arc({
                    let state = state.clone();
                    let cancellation = cancellation.clone();
                    Arc::new(move |_, _| {
                        Ok(state.lock().unwrap().slot.clone().map(|base| BaseReuse {
                            base,
                            cancellation: cancellation.clone(),
                        }))
                    })
                }),
            BaseProviderMock::release
                .each_call(matching!(_))
                .answers_arc({
                    let state = state.clone();
                    Arc::new(move |_, base| {
                        let mut state = state.lock().unwrap();
                        state.releases += 1;
                        state.retired = Some(Arc::downgrade(&base.generation));
                        if state
                            .slot
                            .as_ref()
                            .is_some_and(|slot| Arc::ptr_eq(slot, base))
                        {
                            state.slot = None;
                        }
                    })
                }),
        );
        let provider = Arc::new(if let Some((fresh, _)) = &fresh {
            Unimock::new((
                retention,
                BaseProviderMock::prepare
                    .each_call(matching!(_))
                    .answers_arc({
                        let state = state.clone();
                        let fresh = fresh.clone();
                        Arc::new(move |_, request| {
                            {
                                let mut state = state.lock().unwrap();
                                state.prepares += 1;
                                state.alive_at_prepare += usize::from(
                                    state.retired.as_ref().and_then(Weak::upgrade).is_some(),
                                );
                            }
                            request.steps.step(Step::Rendering);
                            Ok(PreparedBase {
                                generation: fresh.clone(),
                                scripts_off: true,
                                freshness: None,
                            })
                        })
                    }),
                BaseProviderMock::keep.each_call(matching!(_)).answers_arc({
                    let state = state.clone();
                    Arc::new(move |_, _, base| {
                        let mut state = state.lock().unwrap();
                        state.keeps += 1;
                        state.slot = Some(base.clone());
                        Ok(Some(BaseReuse {
                            base,
                            cancellation: cancellation.clone(),
                        }))
                    })
                }),
            ))
        } else {
            Unimock::new(retention)
        });
        let head_failure = Arc::new(AtomicBool::new(false));
        let capture = ComparisonMock::capture_base
            .each_call(matching!(_))
            .answers_arc({
                let state = state.clone();
                Arc::new(move |_, base| {
                    state.lock().unwrap().captures += 1;
                    Ok(base)
                })
            });
        let compare = ComparisonMock::compare_prepared
            .each_call(matching!(_))
            .answers_arc({
                let state = state.clone();
                let head_failure = head_failure.clone();
                Arc::new(move |_, request, before, after| {
                    state.lock().unwrap().comparisons += 1;
                    let source = if head_failure.load(Ordering::Acquire) {
                        &after
                    } else {
                        &before
                    };
                    source.resource_digest("static/image.png").compare()?;
                    Ok(result(request, before, after))
                })
            });
        let comparison = Arc::new(match (fresh.is_some(), compares) {
            (true, true) => Unimock::new((capture, compare)),
            (true, false) => Unimock::new(capture),
            (false, true) => Unimock::new(compare),
            (false, false) => Unimock::new(()),
        });
        let steps = Arc::new(Unimock::new(
            StepsMock::step.each_call(matching!(_)).answers_arc({
                let state = state.clone();
                Arc::new(move |_, step| state.lock().unwrap().steps.push(step))
            }),
        ));
        Self {
            changes: Changes {
                lookup: Arc::new(Unimock::new(())),
                pinned: Some(Arc::new(PinnedBase {
                    reference: "selected".into(),
                    repository: Arc::new(Unimock::new(())),
                    commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
                })),
                sources,
                provider,
                comparison,
                steps,
            },
            state,
            cancelled,
            head_failure,
        }
    }

    pub(super) fn classify(&self) -> Result<ComparisonResult> {
        let head: Arc<dyn RenderGeneration> =
            Arc::new(if self.head_failure.load(Ordering::Acquire) {
                Unimock::new(
                    RenderGenerationMock::resource_digest
                        .each_call(matching!(_))
                        .answers(&|_, _| Err(provider_error())),
                )
            } else {
                Unimock::new(())
            });
        self.changes.classify(&config(), None, head, None)
    }
}
