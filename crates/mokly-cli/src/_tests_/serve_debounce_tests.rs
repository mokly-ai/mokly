//! Fake-clock boundaries prove accepted events reset debounce and ignored events do not.

use std::collections::BTreeSet;
use std::future::pending;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_watch::event::{Action, Batch, Event, Kind};
use mokly_watch::plan::Plan;
use tokio::sync::{Notify, mpsc};
use unimock::{MockFn, Unimock, matching};

use crate::serve_rebuild::Serving;
use crate::serve_watch::WatchInputsMock;

use super::settle;

#[tokio::test(start_paused = true)]
async fn accepted_events_reset_the_deadline_and_ignored_events_keep_it() {
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: vec![],
        roots: vec![],
    };
    let plan = Plan::new(&config, &[], &[], &BTreeSet::new()).unwrap();
    let ready = Arc::new(Notify::new());
    let drained = Arc::new(Notify::new());
    let calls = Arc::new(AtomicUsize::new(0));
    let watch = Unimock::new((
        WatchInputsMock::plan.next_call(matching!()).returns(plan),
        WatchInputsMock::changed
            .each_call(matching!())
            .answers_arc(Arc::new({
                let ready = ready.clone();
                move |_| {
                    let ready = ready.clone();
                    Box::pin(async move { ready.notified().await })
                }
            })),
        WatchInputsMock::drain
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let drained = drained.clone();
                let calls = calls.clone();
                move |_, batch, _| {
                    let accepted = calls.fetch_add(1, Ordering::SeqCst) == 0;
                    if accepted {
                        batch.insert(
                            Event {
                                path: "/repo/mokly.config.json".into(),
                                kind: Kind::File,
                            },
                            Action::Config,
                        );
                    }
                    drained.notify_one();
                    accepted
                }
            }))
            .n_times(2),
    ));
    let (_sender, mut requests) = mpsc::channel(1);
    let task = tokio::spawn(async move {
        let mut batch = Batch::default();
        batch.rebuild();
        let mut serving: Serving<'_> = Box::pin(pending());
        let result = settle(
            Arc::new(watch),
            &mut batch,
            Arc::new(Unimock::new(())),
            &mut requests,
            &mut serving,
        )
        .await;
        assert!(result.is_none());
        batch
    });
    tokio::task::yield_now().await;
    tokio::time::advance(Duration::from_millis(40)).await;
    ready.notify_one();
    drained.notified().await;
    tokio::time::advance(Duration::from_millis(50)).await;
    assert!(!task.is_finished());
    ready.notify_one();
    drained.notified().await;
    tokio::time::advance(Duration::from_millis(24)).await;
    assert!(!task.is_finished());
    tokio::time::advance(Duration::from_millis(1)).await;
    let batch = task.await.unwrap();
    assert_eq!(batch.action, Some(Action::Config));
    assert_eq!(batch.events.len(), 1);
    assert_eq!(calls.load(Ordering::SeqCst), 2);
}
