//! Queued and detached reference probes retain their activity until they return.

use std::sync::{Arc, Mutex, mpsc};
use std::task::{Context, Waker};

use tokio::runtime::Builder;
use tokio::sync::{oneshot, watch};
use unimock::{MockFn, Unimock, matching};

use crate::changes::ChangeSourceMock;
use crate::error::ServerError;
use crate::publication::Publications;

use super::support::{Counts, Release, activity, setup};

#[test]
fn queued_reference_keeps_activity_after_owner_cancellation_until_probe_returns() {
    let runtime = Builder::new_current_thread()
        .enable_all()
        .max_blocking_threads(1)
        .build()
        .unwrap();
    runtime.block_on(async {
        let counts = Arc::new(Counts::default());
        let activity = activity(counts.clone());
        let (occupied, occupying) = oneshot::channel();
        let (unblock, blocked) = mpsc::channel();
        let occupant = tokio::task::spawn_blocking(move || {
            occupied.send(()).unwrap();
            blocked.recv().unwrap();
        });
        let unblock = Release(unblock);
        occupying.await.unwrap();
        let (entered, entering) = oneshot::channel();
        let entered = Mutex::new(Some(entered));
        let (release, released) = mpsc::channel();
        let released = Mutex::new(released);
        let source = Unimock::new(
            ChangeSourceMock::references
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    let _ = entered.lock().unwrap().take().unwrap().send(());
                    released.lock().unwrap().recv().unwrap();
                    Err(ServerError::ChangesReplaced)
                })),
        );
        let release = Release(release);
        let (pass, origin, publications) = setup(
            Arc::new(source.clone()),
            Arc::new(activity.clone()),
            Arc::new(Unimock::new(())),
        );
        let (_stop, stopping) = watch::channel(false);
        let queued = {
            let mut run = Box::pin(pass.run(origin, stopping));
            assert!(
                run.as_mut()
                    .poll(&mut Context::from_waker(Waker::noop()))
                    .is_pending()
            );
            counts.state()
        };
        let cancelled = counts.state();
        unblock.0.send(()).unwrap();
        occupant.await.unwrap();
        entering.await.unwrap();
        let running = counts.state();
        release.0.send(()).unwrap();
        tokio::task::spawn_blocking(|| ()).await.unwrap();
        assert_eq!(queued, (1, 0), "a queued probe must stop new store units");
        assert_eq!(
            cancelled,
            (1, 0),
            "cancelling its owner must retain the queued probe's activity"
        );
        assert_eq!(running, (1, 0), "a detached probe must retain its activity");
        assert_eq!(counts.state(), (0, 1));
        assert_eq!(publications.current().index.revision, 1);
    });
}
