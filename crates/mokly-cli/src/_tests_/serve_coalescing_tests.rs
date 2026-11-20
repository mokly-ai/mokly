//! An HTTP request coalesced behind a background view must let that view progress.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, Weak, mpsc};

use mokly_server::backend::DocumentsMock;
use mokly_server::work::{Work, Workers};
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::wire::MethodResult;
use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use crate::serve_pool::{PoolScheduling, ServePool};

use super::serve_pool_support::{capacity, css, dispatch};

#[tokio::test]
async fn a_coalesced_http_request_does_not_block_the_active_background_views_next_call() {
    let owner = Arc::new(Mutex::new(Weak::<ServePool>::new()));
    let entered = Arc::new(AtomicBool::new(false));
    let inner = Unimock::new((
        PoolMock::request
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let owner = owner.clone();
                let entered = entered.clone();
                move |_, _| {
                    let scheduler = owner.lock().unwrap().upgrade().unwrap();
                    let _state = scheduler.gate.state.lock().unwrap();
                    entered.store(true, Ordering::SeqCst);
                    scheduler.gate.changed.notify_all();
                    Ok(MethodResult::Empty)
                }
            })),
        PoolMock::cancel_requests
            .some_call(matching!())
            .returns(Ok(())),
    ));
    let scheduler = Arc::new(ServePool::new(Arc::new(inner.clone()), capacity(1)));
    *owner.lock().unwrap() = Arc::downgrade(&scheduler);
    let head = scheduler.pool(None);
    let route = Arc::new(Mutex::new(()));
    let (started, starting) = oneshot::channel();
    let started = Mutex::new(Some(started));
    let (http_started, http_starting) = oneshot::channel();
    let http_started = Mutex::new(Some(http_started));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let succeeded = Arc::new(AtomicBool::new(false));
    let documents = Unimock::new((
        DocumentsMock::background
            .some_call(matching!("shared"))
            .answers_arc(Arc::new({
                let route = route.clone();
                let head = head.clone();
                let succeeded = succeeded.clone();
                move |_, _| {
                    let _route = route.lock().unwrap();
                    head.request(css("/head", 0)).unwrap();
                    started.lock().unwrap().take().unwrap().send(()).unwrap();
                    released.lock().unwrap().recv().unwrap();
                    succeeded.store(
                        matches!(head.request(css("/head", 1)), Ok(MethodResult::Empty)),
                        Ordering::SeqCst,
                    );
                    Ok(Vec::new())
                }
            })),
        DocumentsMock::generated
            .some_call(matching!("shared"))
            .answers_arc(Arc::new(move |_, _| {
                http_started
                    .lock()
                    .unwrap()
                    .take()
                    .unwrap()
                    .send(())
                    .unwrap();
                let _route = route.lock().unwrap();
                Ok(None)
            })),
    ));
    let work =
        Arc::new(Workers::new(2, Arc::new(Unimock::new(()))).with_foreground(scheduler.clone()));
    let background = tokio::spawn({
        let work = work.clone();
        let documents = Arc::new(documents.clone());
        async move {
            work.background(documents, "shared".into(), dispatch(2))
                .await
        }
    });
    starting.await.unwrap();
    entered.store(false, Ordering::SeqCst);
    let http = tokio::spawn({
        let work = work.clone();
        let documents = Arc::new(documents.clone());
        async move { work.generated(documents, "shared".into()).await }
    });
    http_starting.await.unwrap();
    release.send(()).unwrap();
    let progressed = tokio::task::spawn_blocking({
        let scheduler = scheduler.clone();
        let entered = entered.clone();
        move || {
            let mut state = scheduler.gate.state.lock().unwrap();
            while state.waiting == 0 && !entered.load(Ordering::SeqCst) {
                state = scheduler.gate.changed.wait(state).unwrap();
            }
            entered.load(Ordering::SeqCst)
        }
    })
    .await
    .unwrap();
    head.cancel_requests().unwrap();
    background.await.unwrap().unwrap();
    assert!(http.await.unwrap().unwrap().is_none());
    work.stop().await;
    assert!(progressed);
    assert!(succeeded.load(Ordering::SeqCst));
}
