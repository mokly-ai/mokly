//! A resource that the observer attached after an adoption joins the adopted records, so a
//! later rebuild with that resource reuses a record without a new plan or attachment. A
//! failed attachment and a newer adoption keep the records as they are.

use std::collections::BTreeSet;
use std::path::Path;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use mokly_graph::resource_inputs::ResourceObserver;
use mokly_graph::types::RenderGenerationMock;
use mokly_watch::event::Batch;
use mokly_watch::observer::{Observer, ObserverMock};
use unimock::{Clause, MockFn, Unimock, matching};

use super::WatchInputs;
use super::serve_watch_coverage_tests::{adoptable, adopted};
use super::serve_watch_tests::{catalogue, prepared, watch};
use crate::serve_rebuild::RebuildReporterMock;
use crate::serve_watch_plan::PlanInputs;

/// The startup generation. After a warm start its resource recordings are empty.
fn startup() -> impl Clause {
    (
        adoptable(),
        RenderGenerationMock::generation_key
            .each_call(matching!())
            .returns("startup"),
    )
}

/// A generation of the shared catalogue, read by one candidate, whose resource recordings
/// hold `resources`.
fn recorded(resources: &[&str]) -> impl Clause {
    let resources: BTreeSet<String> = resources.iter().map(|path| (*path).into()).collect();
    (
        RenderGenerationMock::catalogue
            .some_call(matching!())
            .returns(catalogue()),
        RenderGenerationMock::stylesheet_directories
            .some_call(matching!())
            .returns(vec![]),
        RenderGenerationMock::watch_files
            .some_call(matching!())
            .returns(resources),
    )
}

#[tokio::test]
async fn a_resource_observed_after_a_warm_start_joins_the_record_that_a_later_rebuild_reuses() {
    let adopted = adopted(
        startup(),
        ObserverMock::take.some_call(matching!()).returns(vec![]),
    );
    let watch = &adopted.watch;
    let logo = Path::new("/repo/assets/logo.svg");
    watch.observe("startup", "assets/logo.svg");
    assert!(
        !watch
            .drain(&mut Batch::default(), Arc::new(Unimock::new(())))
            .await
    );
    assert!(watch.plan().exact.contains_key(logo));
    assert_eq!(adopted.attached.lock().unwrap().len(), 2);
    let later = prepared("specs", Unimock::new(recorded(&["assets/logo.svg"])));
    let candidate = watch.candidate(&later).unwrap();
    assert_eq!(adopted.attached.lock().unwrap().len(), 2);
    assert!(!candidate.recheck);
    assert!(Arc::ptr_eq(&candidate.observer, &adopted.active));
    assert!(candidate.record.plan.exact.contains_key(logo));
}

#[tokio::test]
async fn a_failed_observer_update_keeps_the_records_without_the_resource() {
    let adopted = adopted(
        startup(),
        ObserverMock::take.some_call(matching!()).returns(vec![]),
    );
    let watch = &adopted.watch;
    let before = watch.state.lock().unwrap().records.clone().unwrap();
    adopted.failing.store(true, Ordering::SeqCst);
    watch.observe("startup", "assets/logo.svg");
    let reporter = Unimock::new(
        RebuildReporterMock::server_failure
            .some_call(matching!(_, _))
            .returns(()),
    );
    assert!(!watch.drain(&mut Batch::default(), Arc::new(reporter)).await);
    assert!(
        watch
            .plan()
            .exact
            .contains_key(Path::new("/repo/assets/logo.svg"))
    );
    let after = watch.state.lock().unwrap().records.clone().unwrap();
    assert!(Arc::ptr_eq(&before, &after));
    let later = prepared("specs", Unimock::new(recorded(&["assets/logo.svg"])));
    assert!(after.find(&PlanInputs::of(&later)).is_none());
}

/// An adoption to run inside the next observer update of a drain.
type Hook = Arc<Mutex<Option<Box<dyn FnOnce() + Send>>>>;

#[tokio::test]
async fn an_adoption_during_the_drain_keeps_its_records_without_the_drained_resource() {
    let hook: Hook = Arc::new(Mutex::new(None));
    let active: Arc<dyn Observer> = Arc::new(Unimock::new((
        ObserverMock::observes.each_call(matching!(_)).returns(true),
        ObserverMock::take.some_call(matching!()).returns(vec![]),
        ObserverMock::replace
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let hook = hook.clone();
                move |_, _| {
                    let adoption = hook.lock().unwrap().take();
                    if let Some(adopt) = adoption {
                        adopt();
                    }
                    Ok(())
                }
            })),
    )));
    let watch = watch(active, Unimock::new(()));
    let first = prepared("specs", Unimock::new(startup()));
    let candidate = watch.candidate(&first).unwrap();
    watch.clone().adopt(candidate, &first);
    watch.observe("startup", "assets/logo.svg");
    let second = prepared("specs", Unimock::new(adoptable()));
    let candidate = watch.candidate(&second).unwrap();
    *hook.lock().unwrap() = Some(Box::new({
        let watch = watch.clone();
        move || watch.clone().adopt(candidate, &second)
    }));
    assert!(
        !watch
            .drain(&mut Batch::default(), Arc::new(Unimock::new(())))
            .await
    );
    assert!(hook.lock().unwrap().is_none());
    let records = watch.state.lock().unwrap().records.clone().unwrap();
    let later = prepared("specs", Unimock::new(recorded(&["assets/logo.svg"])));
    assert!(records.find(&PlanInputs::of(&later)).is_none());
}
