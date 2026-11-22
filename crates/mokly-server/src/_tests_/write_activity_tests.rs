//! Native graph work retains suppression after its HTTP or usage future is cancelled.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};

use axum::body::Bytes;
use mokly_graph::write_activity::{WriteActivityMock, WriteLease};
use tokio::runtime::Builder;
use tokio::sync::Notify;
use unimock::{MockFn, Unimock, matching};

use crate::assets::File;
use crate::backend::DocumentsMock;
use crate::background_read::BackgroundRead;
use crate::background_support::dispatch;
use crate::work::{Work, Workers};

struct Lease {
    active: Arc<AtomicUsize>,
    finished: Arc<Notify>,
}
impl WriteLease for Lease {}
impl Drop for Lease {
    fn drop(&mut self) {
        self.active.fetch_sub(1, Ordering::SeqCst);
        self.finished.notify_one();
    }
}
struct Release(mpsc::Sender<()>);
impl Drop for Release {
    fn drop(&mut self) {
        let _ = self.0.send(());
    }
}

#[test]
fn cancelled_native_html_work_keeps_writer_suppression_until_the_blocking_job_returns() {
    Builder::new_current_thread()
        .enable_all()
        .max_blocking_threads(1)
        .build()
        .unwrap()
        .block_on(cancelled_native_work());
}

/// One blocking thread makes the queued sentinel fence complete closure teardown.
async fn cancelled_native_work() {
    for phase in ["lookup", "resume", "foreground"] {
        let foreground = phase == "foreground";
        let active = Arc::new(AtomicUsize::new(0));
        let finished = Arc::new(Notify::new());
        let entered = active.clone();
        let ended = finished.clone();
        let activity = Unimock::new(WriteActivityMock::enter.some_call(matching!()).answers_arc(
            Arc::new(move |_| {
                entered.fetch_add(1, Ordering::SeqCst);
                Box::new(Lease {
                    active: entered.clone(),
                    finished: ended.clone(),
                })
            }),
        ));
        let started = Arc::new(Notify::new());
        let observed = started.clone();
        let (release, released) = mpsc::channel();
        let released = Mutex::new(released);
        let documents = if foreground {
            Unimock::new(
                DocumentsMock::generated
                    .some_call(matching!("html"))
                    .answers_arc(Arc::new(move |_, _| {
                        observed.notify_one();
                        released.lock().unwrap().recv().unwrap();
                        Ok(Some(File {
                            bytes: Bytes::from_static(b"html"),
                            content_type: "text/html".into(),
                        }))
                    })),
            )
        } else if phase == "lookup" {
            Unimock::new(
                DocumentsMock::background_read
                    .some_call(matching!("html"))
                    .answers_arc(Arc::new(move |_, _| {
                        observed.notify_one();
                        released.lock().unwrap().recv().unwrap();
                        Ok(Some(BackgroundRead::Complete(Vec::new())))
                    })),
            )
        } else {
            Unimock::new(
                DocumentsMock::background
                    .some_call(matching!("html"))
                    .answers_arc(Arc::new(move |_, _| {
                        observed.notify_one();
                        released.lock().unwrap().recv().unwrap();
                        Ok(Vec::new())
                    })),
            )
        };
        let workers = Arc::new(
            Workers::new(1, Arc::new(Unimock::new(())))
                .with_activity(Some(Arc::new(activity.clone()))),
        );
        let rendering = documents.clone();
        let job = tokio::spawn(async move {
            if foreground {
                workers
                    .generated(Arc::new(rendering), "html".into())
                    .await
                    .map(|_| ())
            } else {
                workers
                    .background(Arc::new(rendering), "html".into(), dispatch(1))
                    .await
                    .map(|_| ())
            }
        });
        let release = Release(release);
        started.notified().await;
        assert_eq!(active.load(Ordering::SeqCst), 1);
        job.abort();
        assert!(job.await.unwrap_err().is_cancelled());
        assert_eq!(
            active.load(Ordering::SeqCst),
            1,
            "cancelling a waiter must not release a running native job"
        );
        release.0.send(()).unwrap();
        finished.notified().await;
        assert_eq!(active.load(Ordering::SeqCst), 0);
        tokio::task::spawn_blocking(|| ()).await.unwrap();
    }
}
