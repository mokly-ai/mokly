//! Foreground bursts avoid root churn while base admission stays cancellable.

use std::sync::{Arc, Condvar, Mutex, mpsc};
use std::thread;

use mokly_server::backend::DocumentsMock;
use mokly_server::changes::{ChangeCancellation, ChangeToken};
use mokly_server::foreground::Foreground;
use mokly_server::work::{Work, Workers};
use mokly_sidecar::error::Error;
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::wire::MethodResult;
use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use crate::serve_pool::{PoolScheduling, ServePool};

use super::serve_pool_support::{css, pool};

fn waiting(scheduler: &ServePool, count: usize) {
    let mut state = scheduler.gate.state.lock().unwrap();
    while state.waiting != count {
        state = scheduler.gate.changed.wait(state).unwrap();
    }
    assert_eq!(state.active, 0);
}

#[test]
fn whole_foreground_bursts_share_roots_with_one_or_three_workers() {
    for size in [1, 3] {
        let mut counts = Vec::new();
        for views in [4, 16] {
            let (_baseline_owner, inner, baseline) = pool();
            inner.request(css("/base", 0)).unwrap();
            for sequence in 1..=views {
                for root in ["/head", "/base"] {
                    inner.request(css(root, sequence)).unwrap();
                }
            }
            let ungrouped = baseline.lock().unwrap().roots.len();
            assert_eq!(baseline.lock().unwrap().calls.len(), views * 2 + 1);
            inner.abort().unwrap();

            let (_owner, inner, observed) = pool();
            let scheduler = ServePool::new(inner, size);
            let head = scheduler.pool(None);
            let base = scheduler.pool(Some(Arc::new(ChangeToken::default())));
            base.request(css("/base", 0)).unwrap();
            let queued = {
                let _foreground = scheduler.enter();
                let queued: Vec<_> = (1..=views)
                    .map(|sequence| {
                        let base = base.clone();
                        thread::spawn(move || base.request(css("/base", sequence)).unwrap())
                    })
                    .collect();
                waiting(&scheduler, views);
                for sequence in 0..views {
                    head.request(css("/head", sequence)).unwrap();
                }
                assert_eq!(
                    observed.lock().unwrap().calls,
                    std::iter::once("/base".to_owned())
                        .chain(std::iter::repeat_n("/head".to_owned(), views))
                        .collect::<Vec<_>>()
                );
                queued
            };
            for job in queued {
                job.join().unwrap();
            }
            {
                let events = observed.lock().unwrap();
                assert_eq!(events.calls.len(), views * 2 + 1);
                assert!(events.calls[views + 1..].iter().all(|root| root == "/base"));
                assert_eq!(events.roots.len(), 3);
                if size == 1 {
                    assert_eq!(events.roots, ["/base", "/head", "/base"]);
                    assert_eq!(ungrouped, views * 2 + 1);
                }
                println!(
                    "workers={size} views={views} ungrouped_root_runs={ungrouped} grouped_root_runs={}",
                    events.roots.len()
                );
                counts.push(events.roots.len());
            }
            head.abort().unwrap();
        }
        assert!(counts[1] * 2 <= counts[0] * 9);
        if size == 1 {
            assert_eq!(counts[0], counts[1]);
        }
    }
}

#[test]
fn cancellation_wakes_queued_base_work_without_waiting_for_the_foreground() {
    let inner = Unimock::new(());
    let scheduler = ServePool::new(Arc::new(inner.clone()), 1);
    let _foreground = scheduler.enter();
    let token: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
    let base = scheduler.pool(Some(token.clone()));
    let waiting_base = thread::spawn(move || base.request(css("/base", 0)));
    waiting(&scheduler, 1);
    token.cancel();
    assert!(matches!(
        waiting_base.join().unwrap(),
        Err(Error::Cancelled)
    ));
    assert_eq!(scheduler.gate.state.lock().unwrap().foreground, 1);
    let late = scheduler.pool(Some(token));
    assert!(matches!(
        late.request(css("/base", 1)),
        Err(Error::Cancelled)
    ));
}

#[test]
fn shutdown_closes_both_sides_and_wakes_pending_admission() {
    let inner = Unimock::new(
        PoolMock::cancel_requests
            .next_call(matching!())
            .returns(Ok(())),
    );
    let scheduler = ServePool::new(Arc::new(inner.clone()), 1);
    let _foreground = scheduler.enter();
    let head = scheduler.pool(None);
    let base = scheduler.pool(Some(Arc::new(ChangeToken::default())));
    let queued = thread::spawn(move || base.request(css("/base", 0)));
    waiting(&scheduler, 1);
    head.cancel_requests().unwrap();
    assert!(matches!(queued.join().unwrap(), Err(Error::Cancelled)));
    assert!(matches!(
        head.request(css("/head", 0)),
        Err(Error::Cancelled)
    ));
}

#[tokio::test]
async fn http_priority_covers_gaps_between_a_documents_sidecar_calls() {
    let (_owner, inner, observed) = pool();
    let scheduler = Arc::new(ServePool::new(inner, 1));
    let head = scheduler.pool(None);
    let base = scheduler.pool(Some(Arc::new(ChangeToken::default())));
    base.request(css("/base", 0)).unwrap();
    let (started, starting) = oneshot::channel();
    let started = Mutex::new(Some(started));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let rendered_head = head.clone();
    let documents = Unimock::new(
        DocumentsMock::generated
            .next_call(matching!("page"))
            .answers_arc(Arc::new(move |_, _| {
                rendered_head.request(css("/head", 0)).unwrap();
                started.lock().unwrap().take().unwrap().send(()).unwrap();
                released.lock().unwrap().recv().unwrap();
                rendered_head.request(css("/head", 1)).unwrap();
                Ok(None)
            })),
    );
    let work: Arc<dyn Work> =
        Arc::new(Workers::new(1, Arc::new(Unimock::new(()))).with_foreground(scheduler.clone()));
    let worker = work.clone();
    let input = Arc::new(documents.clone());
    let http = tokio::spawn(async move { worker.generated(input, "page".into()).await });
    starting.await.unwrap();
    let queued = thread::spawn(move || base.request(css("/base", 1)));
    waiting(&scheduler, 1);
    assert_eq!(observed.lock().unwrap().calls, ["/base", "/head"]);
    release.send(()).unwrap();
    assert!(http.await.unwrap().unwrap().is_none());
    queued.join().unwrap().unwrap();
    work.stop().await;
    head.abort().unwrap();
    let events = observed.lock().unwrap();
    assert_eq!(events.calls, ["/base", "/head", "/head", "/base"]);
    assert_eq!(events.roots, ["/base", "/head", "/base"]);
}

#[test]
fn base_admission_never_exceeds_the_configured_worker_count() {
    for size in [1, 3] {
        let block = Arc::new((Mutex::new(false), Condvar::new()));
        let gate = block.clone();
        let inner = Unimock::new(
            PoolMock::request
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    let mut released = gate.0.lock().unwrap();
                    while !*released {
                        released = gate.1.wait(released).unwrap();
                    }
                    Ok(MethodResult::Empty)
                }))
                .n_times(size * 4),
        );
        let scheduler = ServePool::new(Arc::new(inner.clone()), size);
        let base = scheduler.pool(Some(Arc::new(ChangeToken::default())));
        let jobs: Vec<_> = (0..size * 4)
            .map(|index| {
                let base = base.clone();
                thread::spawn(move || base.request(css("/base", index)).unwrap())
            })
            .collect();
        {
            let mut state = scheduler.gate.state.lock().unwrap();
            while state.waiting != size * 3 {
                state = scheduler.gate.changed.wait(state).unwrap();
            }
            assert_eq!(state.active, size);
        }
        *block.0.lock().unwrap() = true;
        block.1.notify_all();
        for job in jobs {
            job.join().unwrap();
        }
        assert_eq!(scheduler.gate.state.lock().unwrap().active, 0);
    }
}
