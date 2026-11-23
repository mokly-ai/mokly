//! A candidate attaches only what the active observer lacks. Changed roots ask for a second
//! preparation only when uncovered, and equal plan inputs reuse the active plan and observer.

use std::collections::BTreeSet;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_graph::resource_inputs::ResourceObserver;
use mokly_graph::types::RenderGenerationMock;
use mokly_watch::error::Error;
use mokly_watch::event::{Action, Batch, Event, Kind};
use mokly_watch::observer::{Observer, ObserverMock};
use mokly_watch::plan::Plan;
use unimock::{Clause, MockFn, Unimock, matching};

use super::serve_watch_tests::{catalogue, plan, prepared, watch};
use super::{WatchInputs, WatchedInputs};
use crate::serve_rebuild::RebuildReporterMock;
use crate::serve_watch_files::ObserversMock;

fn generation() -> Unimock {
    generation_of(catalogue())
}

/// A generation of `catalogue` that one candidate reads.
fn generation_of(catalogue: PreparedCatalogue) -> Unimock {
    Unimock::new((
        RenderGenerationMock::observe_resources
            .some_call(matching!(_))
            .returns(()),
        RenderGenerationMock::catalogue
            .next_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::stylesheet_directories
            .next_call(matching!())
            .returns(vec![]),
        RenderGenerationMock::watch_files
            .next_call(matching!())
            .returns(BTreeSet::new()),
    ))
}

/// A generation of `catalogue` that one candidate reads and one adoption subscribes to.
fn adoptable_from(catalogue: PreparedCatalogue) -> impl Clause {
    (
        RenderGenerationMock::catalogue
            .some_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::stylesheet_directories
            .some_call(matching!())
            .returns(vec![]),
        RenderGenerationMock::watch_files
            .each_call(matching!())
            .returns(BTreeSet::new()),
        RenderGenerationMock::observe_resources
            .some_call(matching!(_))
            .returns(()),
    )
}

/// A generation of the shared catalogue that one candidate reads and one adoption
/// subscribes to.
pub(super) fn adoptable() -> impl Clause {
    adoptable_from(catalogue())
}

/// A watch that adopted one candidate of the generation `first`. Its active observer
/// answers `extra`, watches every directory, and records each plan that it attaches.
/// Setting `failing` fails the next attachment.
struct Adopted {
    watch: Arc<WatchedInputs>,
    active: Arc<dyn Observer>,
    attached: Arc<Mutex<Vec<Plan>>>,
    failing: Arc<AtomicBool>,
}

fn adopted(first: impl Clause, extra: impl Clause) -> Adopted {
    let attached = Arc::new(Mutex::new(Vec::new()));
    let failing = Arc::new(AtomicBool::new(false));
    let active: Arc<dyn Observer> = Arc::new(Unimock::new((
        ObserverMock::observes.each_call(matching!(_)).returns(true),
        ObserverMock::replace
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let attached = attached.clone();
                let failing = failing.clone();
                move |_, plan: &Plan| {
                    attached.lock().unwrap().push(plan.clone());
                    if failing.swap(false, Ordering::SeqCst) {
                        Err(Error::Rescan)
                    } else {
                        Ok(())
                    }
                }
            })),
        extra,
    )));
    let watch = watch(active.clone(), Unimock::new(()));
    let first = prepared("specs", Unimock::new(first));
    let candidate = watch.candidate(&first).unwrap();
    watch.clone().adopt(candidate, &first);
    Adopted {
        watch,
        active,
        attached,
        failing,
    }
}

#[test]
fn changed_roots_attach_a_new_observer_and_recheck_only_when_uncovered() {
    for covered in [true, false] {
        let active = Arc::new(Unimock::new((
            ObserverMock::observes.each_call(matching!(_)).returns(true),
            ObserverMock::covers
                .next_call(
                    matching!((plan) if plan.roots.contains(std::path::Path::new("/repo/next"))),
                )
                .returns(covered),
        )));
        let next: Arc<dyn Observer> = Arc::new(Unimock::new(()));
        let factory = Unimock::new(
            ObserversMock::attach
                .next_call(
                    matching!((plan) if plan.roots.contains(std::path::Path::new("/repo/next"))),
                )
                .returns(Ok(next.clone())),
        );
        let watch = watch(active.clone(), factory);
        let candidate = watch.candidate(&prepared("next", generation())).unwrap();
        assert_eq!(candidate.recheck, !covered);
        assert!(Arc::ptr_eq(&candidate.observer, &next));
        assert!(Arc::ptr_eq(
            &watch.state.lock().unwrap().observer,
            &(active as Arc<dyn Observer>)
        ));
        assert_eq!(watch.plan().roots, plan("specs").roots);
    }
}

#[test]
fn the_adoption_after_a_second_preparation_installs_its_plan() {
    let active: Arc<dyn Observer> = Arc::new(Unimock::new((
        ObserverMock::observes.each_call(matching!(_)).returns(true),
        ObserverMock::covers.some_call(matching!(_)).returns(false),
        ObserverMock::take.some_call(matching!()).returns(vec![]),
        ObserverMock::close.some_call(matching!()).returns(()),
    )));
    let next: Arc<dyn Observer> = Arc::new(Unimock::new((
        ObserverMock::observes.each_call(matching!(_)).returns(true),
        ObserverMock::replace
            .some_call(matching!((plan) if plan.exact.contains_key(Path::new("/repo/src/new.ts"))))
            .returns(Ok(())),
        ObserverMock::replay.some_call(matching!(_)).returns(()),
    )));
    let factory = Unimock::new(
        ObserversMock::attach
            .some_call(matching!(_))
            .returns(Ok(next)),
    );
    let watch = watch(active, factory);
    let mut first = catalogue();
    first.model.sources.clear();
    let mut candidate = watch
        .candidate(&prepared("next", generation_of(first)))
        .unwrap();
    assert!(candidate.recheck);
    let second = prepared("next", Unimock::new(adoptable()));
    watch.recheck(&mut candidate, &second).unwrap();
    watch.clone().adopt(candidate, &second);
    assert!(
        watch
            .plan()
            .exact
            .contains_key(Path::new("/repo/src/new.ts"))
    );
}

#[tokio::test]
async fn equal_plan_inputs_reuse_the_active_observer_and_a_queued_edit_still_rebuilds() {
    let adopted = adopted(
        adoptable(),
        (
            ObserverMock::resource
                .some_call(matching!(_))
                .returns(Ok(())),
            ObserverMock::take.next_call(matching!()).returns(vec![]),
            ObserverMock::take
                .next_call(matching!())
                .returns(vec![Ok(Event {
                    path: "/repo/specs/edited.screen.html".into(),
                    kind: Kind::File,
                })]),
        ),
    );
    let watch = &adopted.watch;
    let resources = watch.state.lock().unwrap().resources.clone().unwrap();
    resources.observe("first", "assets/stale.svg").unwrap();
    assert!(
        !watch
            .drain(&mut Batch::default(), Arc::new(Unimock::new(())))
            .await
    );
    assert_eq!(adopted.attached.lock().unwrap().len(), 2);
    let second = prepared("specs", Unimock::new(adoptable()));
    let candidate = watch.candidate(&second).unwrap();
    assert_eq!(adopted.attached.lock().unwrap().len(), 2);
    assert!(!candidate.recheck);
    assert!(Arc::ptr_eq(&candidate.observer, &adopted.active));
    assert!(Arc::ptr_eq(
        &watch.state.lock().unwrap().observer,
        &adopted.active
    ));
    assert!(
        !candidate
            .record
            .plan
            .exact
            .contains_key(Path::new("/repo/assets/stale.svg"))
    );
    watch.clone().adopt(candidate, &second);
    let mut batch = Batch::default();
    assert!(watch.drain(&mut batch, Arc::new(Unimock::new(()))).await);
    assert_eq!(batch.action, Some(Action::Rebuild));
    assert_eq!(batch.events.len(), 1);
    let attached = adopted.attached.lock().unwrap();
    assert_eq!(attached.len(), 3);
    let stale = Path::new("/repo/assets/stale.svg");
    assert!(!attached[2].exact.contains_key(stale));
    assert!(!watch.plan().exact.contains_key(stale));
}

#[test]
fn a_changed_plan_input_attaches_the_new_plan() {
    let mut first = catalogue();
    first.model.sources.clear();
    let adopted = adopted(adoptable_from(first), ());
    adopted
        .watch
        .candidate(&prepared("specs", generation()))
        .unwrap();
    let attached = adopted.attached.lock().unwrap();
    assert_eq!(attached.len(), 2);
    assert!(
        attached[1]
            .exact
            .contains_key(Path::new("/repo/src/new.ts"))
    );
}

#[test]
fn after_a_failed_rebuild_an_equal_candidate_attaches_again() {
    let adopted = adopted(adoptable(), ());
    adopted.watch.failed();
    adopted
        .watch
        .candidate(&prepared("specs", generation()))
        .unwrap();
    assert_eq!(adopted.attached.lock().unwrap().len(), 2);
}

#[tokio::test]
async fn after_a_failed_observer_update_an_equal_candidate_attaches_again() {
    let adopted = adopted(
        adoptable(),
        ObserverMock::take.some_call(matching!()).returns(vec![]),
    );
    adopted.failing.store(true, Ordering::SeqCst);
    let reporter = Unimock::new(
        RebuildReporterMock::server_failure
            .some_call(matching!(_, _))
            .returns(()),
    );
    assert!(
        !adopted
            .watch
            .drain(&mut Batch::default(), Arc::new(reporter))
            .await
    );
    adopted
        .watch
        .candidate(&prepared("specs", generation()))
        .unwrap();
    assert_eq!(adopted.attached.lock().unwrap().len(), 3);
}
