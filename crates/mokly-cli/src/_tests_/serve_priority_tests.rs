//! HTTP sidecar calls precede queued background views across graph worker hops.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_graph::render_class::RenderClass;
use mokly_graph::workers::{ComparisonTaskMock, RenderWorkers, ThreadWorkers};
use mokly_server::backend::{Documents, DocumentsMock};
use mokly_server::changes::{ChangeCancellation, ChangeToken};
use mokly_server::work::{Work, Workers};
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::{PoolMock, SidecarPool};
use mokly_sidecar::pool_admission::CapacityMock;
use mokly_sidecar::pool_claim::CallClaim;
use mokly_sidecar::wire::MethodResult;
use unimock::{MockFn, Unimock, matching};

use crate::serve_pool::{PoolScheduling, ServePool};
use crate::serve_return::ReturnAdmission;

use super::serve_pool_support::{css, dispatch};

async fn queued(scheduler: Arc<ServePool>, total: usize) {
    tokio::task::spawn_blocking(move || {
        let mut state = scheduler.gate.state.lock().unwrap();
        while state.active + state.waiting != total {
            state = scheduler.gate.changed.wait(state).unwrap();
        }
    })
    .await
    .unwrap();
}

fn documents(
    pool: Arc<dyn SidecarPool>,
    classes: Arc<Mutex<Vec<RenderClass>>>,
) -> (Unimock, Arc<dyn Documents>) {
    let workers: Arc<dyn RenderWorkers> = Arc::new(ThreadWorkers::new(2).unwrap());
    let render = move |index| {
        let pool = pool.clone();
        let classes = classes.clone();
        let task = Unimock::new(ComparisonTaskMock::run.some_call(matching!(0)).answers_arc(
            Arc::new(move |_, _| {
                classes.lock().unwrap().push(RenderClass::current());
                pool.request(css("/head", index)).unwrap();
            }),
        ));
        workers.comparison_tasks(1, &task);
    };
    let render = Arc::new(render);
    let owner = Unimock::new((
        DocumentsMock::background
            .some_call(matching!("background"))
            .answers_arc(Arc::new({
                let render = render.clone();
                move |_, _| {
                    render(1);
                    Ok(Vec::new())
                }
            })),
        DocumentsMock::generated
            .some_call(matching!("http"))
            .answers_arc(Arc::new(move |_, _| {
                render(2);
                Ok(None)
            })),
    ));
    let shared = Arc::new(owner.clone());
    (owner, shared)
}

async fn priority_after_a_busy_call(base_overlap: bool) {
    let limit = Arc::new(AtomicUsize::new(2));
    let source = Unimock::new((
        CapacityMock::capacity
            .each_call(matching!())
            .answers_arc(Arc::new({
                let limit = limit.clone();
                move |_| limit.load(Ordering::SeqCst)
            })),
        CapacityMock::try_claim
            .each_call(matching!())
            .answers(&|_| Ok(Some(CallClaim::fixed()))),
    ))
    .no_verify_in_drop();
    let (entered, events) = mpsc::channel();
    let mut releases = Vec::new();
    let mut waits = Vec::new();
    for _ in 0..3 {
        let (release, released) = mpsc::channel();
        releases.push(release);
        waits.push(Mutex::new(released));
    }
    let inner = Unimock::new(
        PoolMock::request
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, call| {
                let Call::ProcessCss(params) = call else {
                    panic!()
                };
                let index: usize = params.context.rsplit(':').next().unwrap().parse().unwrap();
                entered.send(index).unwrap();
                waits[index].lock().unwrap().recv().unwrap();
                Ok(MethodResult::Empty)
            })),
    );
    let scheduler = Arc::new(ServePool::new(Arc::new(inner), Arc::new(source)));
    let token: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
    let busy = scheduler.pool(base_overlap.then(|| token.clone()));
    let busy = thread::spawn(move || busy.request(css("/busy", 0)).unwrap());
    assert_eq!(events.recv().unwrap(), 0);
    token.cancel();
    limit.store(1, Ordering::SeqCst);
    let classes = Arc::new(Mutex::new(Vec::new()));
    let (_owner, documents) = documents(scheduler.pool(None), classes.clone());
    let work =
        Arc::new(Workers::new(2, Arc::new(Unimock::new(()))).with_foreground(scheduler.clone()));
    let background = tokio::spawn({
        let work = work.clone();
        let documents = documents.clone();
        async move {
            work.background(documents, "background".into(), dispatch(2))
                .await
        }
    });
    queued(scheduler.clone(), 2).await;
    assert!(
        !scheduler.gate.early_ready(),
        "a head request waiting for admission stops early work"
    );
    let http = tokio::spawn({
        let work = work.clone();
        async move { work.generated(documents, "http".into()).await }
    });
    queued(scheduler.clone(), 3).await;
    releases[0].send(()).unwrap();
    let first = events.recv().unwrap();
    releases[first].send(()).unwrap();
    let second = events.recv().unwrap();
    releases[second].send(()).unwrap();
    busy.join().unwrap();
    background.await.unwrap().unwrap();
    assert!(http.await.unwrap().unwrap().is_none());
    assert!(scheduler.gate.early_ready());
    work.stop().await;
    assert_eq!([first, second], [2, 1]);
    assert_eq!(
        *classes.lock().unwrap(),
        [RenderClass::Background, RenderClass::Foreground]
    );
}

#[tokio::test]
async fn http_precedes_a_background_view_queued_after_memory_falls() {
    priority_after_a_busy_call(false).await;
}

#[tokio::test]
async fn http_precedes_a_background_view_queued_behind_a_cancelled_base_call() {
    priority_after_a_busy_call(true).await;
}
