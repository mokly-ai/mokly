//! Equal watched merge bases leave the ready publication and classifier untouched.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::{oneshot, watch};
use unimock::{MockFn, Unimock, matching};

use crate::changes::ChangeSourceMock;
use crate::changes_background::{AfterUsage, ChangesPass};
use crate::changes_support::fixture;
use crate::comparison_store::ComparisonsMock;
use crate::publication::{Publications, SharedPublication};

#[tokio::test(start_paused = true)]
async fn two_equal_merge_base_polls_preserve_ready_and_classify_once() {
    let (mut origin, result, _graph) = fixture();
    let refs = Arc::new(AtomicUsize::new(0));
    let polled = refs.clone();
    let (finished, finishing) = oneshot::channel();
    let finished = Mutex::new(Some(finished));
    let source = Arc::new(Unimock::new((
        ChangeSourceMock::references
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                polled.fetch_add(1, Ordering::SeqCst);
                Ok("same-merge-base".into())
            }))
            .n_times(4),
        ChangeSourceMock::classify
            .next_call(matching!(_, _))
            .returns(Ok(result)),
        ChangeSourceMock::finished
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, result, _| {
                assert!(result.is_ok());
                finished.lock().unwrap().take().unwrap().send(()).unwrap();
            })),
    )));
    Arc::make_mut(&mut Arc::make_mut(&mut origin).generation).changes = Some(source);
    let publications = Arc::new(SharedPublication::new(origin.clone()));
    let pass = ChangesPass {
        publications: publications.clone(),
        comparisons: Arc::new(Unimock::new((
            ComparisonsMock::check_capacity
                .next_call(matching!(_, _))
                .returns(Ok(())),
            ComparisonsMock::install
                .next_call(matching!(_, _))
                .returns(Ok(())),
            ComparisonsMock::collect
                .each_call(matching!())
                .returns(())
                .n_times(2),
        ))),
        diagnostics: Arc::new(Unimock::new(())),
        watching: true,
    };
    let (stop, stopping) = watch::channel(false);
    let run = tokio::spawn(async move { pass.run(origin, stopping).await });
    finishing.await.unwrap();
    let ready = publications.current();
    assert_eq!(ready.index.changes_status, ChangesStatus::Ready);
    for count in [3, 4] {
        tokio::time::advance(Duration::from_secs(1)).await;
        while refs.load(Ordering::SeqCst) < count {
            tokio::task::yield_now().await;
        }
        assert!(Arc::ptr_eq(&ready, &publications.current()));
    }
    stop.send_replace(true);
    run.await.unwrap();
    assert!(Arc::ptr_eq(&ready, &publications.current()));
}
