//! Adoption keeps candidate resources and replays events without graph calls under watch locks.

use std::collections::BTreeSet;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_graph::resource_inputs::ResourceObserver;
use mokly_graph::types::RenderGenerationMock;
use mokly_watch::event::{Batch, Kind};
use mokly_watch::observer::ObserverMock;
use unimock::{MockFn, Unimock, matching};

use super::WatchInputs;
use super::serve_watch_tests::{event, prepared, watch};
use crate::warning_support::record;

#[tokio::test]
async fn adoption_replays_events_and_subscribes_before_copying_resources() {
    let old = Unimock::new((
        ObserverMock::resource
            .some_call(matching!((path) if path.ends_with("assets/ignored.svg")))
            .returns(Ok(())),
        ObserverMock::take
            .next_call(matching!())
            .returns(vec![Ok(event("specs/queued.screen.html", Kind::File))]),
        ObserverMock::close.next_call(matching!()).returns(()),
    ));
    let next = Unimock::new((
        ObserverMock::resource.some_call(matching!((path) if path.ends_with("assets/later.svg"))).returns(Ok(())),
        ObserverMock::replay.next_call(matching!((events) if events.len() == 1 && events[0].as_ref().unwrap().path.ends_with("queued.screen.html"))).returns(()),
        ObserverMock::take.next_call(matching!()).returns(vec![]),
        ObserverMock::replace.next_call(matching!((plan) if plan.exact.contains_key(std::path::Path::new("/repo/assets/during.svg")) && plan.exact.contains_key(std::path::Path::new("/repo/assets/later.svg")))).returns(Ok(())),
        ObserverMock::close.next_call(matching!()).returns(()),
    ));
    let watch = watch(Arc::new(old.clone()), Unimock::new(()));
    let old_candidate = watch.subscribe(
        record(),
        Arc::new(old.clone()),
        false,
        &prepared(
            "specs",
            Unimock::new(
                RenderGenerationMock::observe_resources
                    .some_call(matching!(_))
                    .returns(()),
            ),
        ),
    );
    let subscribed = Arc::new(AtomicBool::new(false));
    let generation = Unimock::new((
        RenderGenerationMock::observe_resources
            .next_call(matching!(_))
            .answers_arc(Arc::new({
                let subscribed = subscribed.clone();
                move |_, observer| {
                    assert!(observer.upgrade().is_some());
                    subscribed.store(true, Ordering::SeqCst);
                }
            })),
        RenderGenerationMock::watch_files
            .next_call(matching!())
            .answers_arc(Arc::new(move |_| {
                assert!(subscribed.load(Ordering::SeqCst));
                BTreeSet::from(["assets/during.svg".into()])
            })),
    ));
    let prepared = prepared("next", generation);
    let candidate = watch.subscribe(record(), Arc::new(next.clone()), true, &prepared);
    watch.clone().adopt(candidate, &prepared);
    old_candidate
        .resources
        .observe("old", "assets/ignored.svg")
        .unwrap();
    let resources = watch.state.lock().unwrap().resources.clone().unwrap();
    resources.observe("new", "assets/later.svg").unwrap();
    assert!(
        watch
            .plan()
            .exact
            .contains_key(std::path::Path::new("/repo/assets/later.svg"))
    );
    assert!(
        !watch
            .drain(&mut Batch::default(), Arc::new(Unimock::new(())))
            .await
    );
    assert!(
        watch
            .plan()
            .exact
            .contains_key(std::path::Path::new("/repo/assets/later.svg"))
    );
    assert!(
        !watch
            .plan()
            .exact
            .contains_key(std::path::Path::new("/repo/assets/ignored.svg"))
    );
    watch.stop().await.unwrap();
    resources.observe("new", "assets/after-close.svg").unwrap();
    assert!(watch.state.lock().unwrap().pending.is_empty());
}
