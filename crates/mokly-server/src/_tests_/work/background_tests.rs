//! Foreground jobs pass queued background work between document boundaries.

use std::future::Future;
use std::sync::{Arc, Condvar, Mutex};
use std::task::{Context, Waker};

use tokio::sync::Notify;
use unimock::{MockFn, Unimock, matching};

use crate::backend::DocumentsMock;
use crate::work::{Work, Workers, parallelism};

use super::support::{cleanup, release};

#[test]
fn concurrency_follows_available_cpus_with_a_finite_bound() {
    assert_eq!(parallelism(0), 1);
    assert_eq!(parallelism(1), 1);
    assert_eq!(parallelism(3), 3);
    assert_eq!(parallelism(256), 8);
}

#[tokio::test]
async fn foreground_precedes_waiting_background_and_jobs_remain_bounded() {
    let order = Arc::new(Mutex::new(Vec::new()));
    let started = Arc::new(Notify::new());
    let gate = Arc::new((Mutex::new(false), Condvar::new()));
    let _cleanup = cleanup(gate.clone());
    let mock = Unimock::new((
        DocumentsMock::background
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let order = order.clone();
                let started = started.clone();
                let gate = gate.clone();
                move |_, route| {
                    order.lock().unwrap().push(route.to_owned());
                    if route == "first" {
                        started.notify_one();
                        let mut released = gate.0.lock().unwrap();
                        while !*released {
                            released = gate.1.wait(released).unwrap();
                        }
                    }
                    Ok(())
                }
            })),
        DocumentsMock::generated
            .next_call(matching!("foreground"))
            .answers_arc(Arc::new({
                let order = order.clone();
                move |_, _| {
                    order.lock().unwrap().push("foreground".into());
                    Ok(None)
                }
            })),
    ));
    let work = Arc::new(Workers::new(1, Arc::new(Unimock::new(()))));
    let documents = Arc::new(mock.clone());
    let first = tokio::spawn({
        let work = work.clone();
        let documents = documents.clone();
        async move { work.background(documents, "first".into()).await }
    });
    started.notified().await;
    let mut second = Box::pin(work.background(documents.clone(), "second".into()));
    let mut foreground = Box::pin(work.generated(documents, "foreground".into()));
    let mut context = Context::from_waker(Waker::noop());
    assert!(second.as_mut().poll(&mut context).is_pending());
    assert!(foreground.as_mut().poll(&mut context).is_pending());
    assert_eq!(*order.lock().unwrap(), ["first"]);
    release(&gate);
    first.await.unwrap().unwrap();
    let (foreground, second) = tokio::join!(foreground, second);
    foreground.unwrap();
    second.unwrap();
    work.stop().await;
    assert_eq!(*order.lock().unwrap(), ["first", "foreground", "second"]);
}
