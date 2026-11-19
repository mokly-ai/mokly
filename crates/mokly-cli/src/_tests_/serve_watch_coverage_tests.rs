//! A candidate attaches only what the active observer lacks. Changed roots ask for a second
//! preparation only when uncovered, and equal plan inputs reuse the active plan and observer.

use std::collections::BTreeSet;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

use mokly_graph::resource_inputs::ResourceObserver;
use mokly_graph::types::RenderGenerationMock;
use mokly_watch::error::Error;
use mokly_watch::event::{Action, Batch, Event, Kind};
use mokly_watch::observer::{Observer, ObserverMock};
use unimock::{Clause, MockFn, Unimock, matching};

use super::WatchInputs;
use super::serve_watch_tests::{catalogue, plan, prepared, watch};
use crate::serve_rebuild::RebuildReporterMock;
use crate::serve_watch_files::ObserversMock;

fn generation() -> Unimock {
    Unimock::new((
        RenderGenerationMock::catalogue
            .next_call(matching!())
            .returns(catalogue()),
        RenderGenerationMock::stylesheet_directories
            .next_call(matching!())
            .returns(vec![]),
        RenderGenerationMock::watch_files
            .next_call(matching!())
            .returns(BTreeSet::new()),
    ))
}

/// A generation that one candidate reads and one adoption subscribes to.
pub(super) fn adoptable() -> impl Clause {
    (
        RenderGenerationMock::catalogue
            .some_call(matching!())
            .returns(catalogue()),
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

#[tokio::test]
async fn equal_plan_inputs_reuse_the_active_observer_and_a_queued_edit_still_rebuilds() {
    let replaces = Arc::new(AtomicUsize::new(0));
    let active: Arc<dyn Observer> = Arc::new(Unimock::new((
        ObserverMock::observes.each_call(matching!(_)).returns(true),
        ObserverMock::replace
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let replaces = replaces.clone();
                move |_, _| {
                    replaces.fetch_add(1, Ordering::SeqCst);
                    Ok(())
                }
            })),
        ObserverMock::take.next_call(matching!()).returns(vec![]),
        ObserverMock::take
            .next_call(matching!())
            .returns(vec![Ok(Event {
                path: "/repo/specs/edited.screen.html".into(),
                kind: Kind::File,
            })]),
    )));
    let watch = watch(active.clone(), Unimock::new(()));
    let first = prepared(
        "specs",
        Unimock::new((
            adoptable(),
            RenderGenerationMock::generation_key
                .each_call(matching!())
                .returns("first"),
        )),
    );
    let candidate = watch.candidate(&first).unwrap();
    watch.clone().adopt(candidate, &first);
    watch.observe("first", "assets/stale.svg");
    assert!(
        !watch
            .drain(&mut Batch::default(), Arc::new(Unimock::new(())))
            .await
    );
    assert_eq!(replaces.load(Ordering::SeqCst), 2);
    let second = prepared("specs", Unimock::new(adoptable()));
    let candidate = watch.candidate(&second).unwrap();
    assert_eq!(replaces.load(Ordering::SeqCst), 2);
    assert!(!candidate.recheck);
    assert!(Arc::ptr_eq(&candidate.observer, &active));
    assert!(Arc::ptr_eq(&watch.state.lock().unwrap().observer, &active));
    assert!(
        !candidate
            .plan
            .exact
            .contains_key(Path::new("/repo/assets/stale.svg"))
    );
    watch.clone().adopt(candidate, &second);
    let mut batch = Batch::default();
    assert!(watch.drain(&mut batch, Arc::new(Unimock::new(()))).await);
    assert_eq!(batch.action, Some(Action::Rebuild));
    assert_eq!(batch.events.len(), 1);
    assert_eq!(replaces.load(Ordering::SeqCst), 3);
}

#[tokio::test]
async fn after_a_failed_rebuild_or_observer_update_an_equal_candidate_attaches_again() {
    for failure in ["rebuild", "observer update"] {
        let replaces = Arc::new(AtomicUsize::new(0));
        let failing = Arc::new(AtomicBool::new(false));
        let clauses = (
            ObserverMock::observes.each_call(matching!(_)).returns(true),
            ObserverMock::replace
                .each_call(matching!(_))
                .answers_arc(Arc::new({
                    let replaces = replaces.clone();
                    let failing = failing.clone();
                    move |_, _| {
                        replaces.fetch_add(1, Ordering::SeqCst);
                        if failing.swap(false, Ordering::SeqCst) {
                            Err(Error::Rescan)
                        } else {
                            Ok(())
                        }
                    }
                })),
        );
        let active: Arc<dyn Observer> = Arc::new(if failure == "rebuild" {
            Unimock::new(clauses)
        } else {
            Unimock::new((
                clauses,
                ObserverMock::take.some_call(matching!()).returns(vec![]),
            ))
        });
        let watch = watch(active, Unimock::new(()));
        let first = prepared("specs", Unimock::new(adoptable()));
        let candidate = watch.candidate(&first).unwrap();
        watch.clone().adopt(candidate, &first);
        if failure == "rebuild" {
            watch.failed();
        } else {
            failing.store(true, Ordering::SeqCst);
            let reporter = Unimock::new(
                RebuildReporterMock::server_failure
                    .some_call(matching!(_, _))
                    .returns(()),
            );
            assert!(!watch.drain(&mut Batch::default(), Arc::new(reporter)).await);
        }
        let before = replaces.load(Ordering::SeqCst);
        watch.candidate(&prepared("specs", generation())).unwrap();
        assert_eq!(replaces.load(Ordering::SeqCst), before + 1, "{failure}");
    }
}
