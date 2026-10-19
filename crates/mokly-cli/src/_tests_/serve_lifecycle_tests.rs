//! Busy sidecars are cancelled only after watcher stop and before idle shutdown.

use std::sync::{Arc, Mutex};

use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_server::shutdown::Lifecycle;
use mokly_sidecar::pool::PoolMock;
use unimock::{MockFn, Unimock, matching};

use crate::serve_watch::WatchInputsMock;

use super::ServeLifecycle;

#[tokio::test]
async fn watcher_cancellation_and_idle_shutdown_follow_the_documented_order() {
    let cancellation: Arc<dyn Cancellation> = Arc::new(ServeCancellation::default());
    let observed = cancellation.clone();
    let mock = Unimock::new((
        WatchInputsMock::stop.next_call(matching!()).returns(Ok(())),
        PoolMock::cancel_requests
            .next_call(matching!())
            .answers_arc(Arc::new(move |_| {
                assert!(observed.requested());
                Ok(())
            })),
        crate::serve_git::GitWorkMock::cancel
            .next_call(matching!())
            .returns(()),
        PoolMock::shutdown.next_call(matching!()).returns(Ok(())),
    ));
    let lifecycle = ServeLifecycle {
        git: Arc::new(mock.clone()),
        watch: Mutex::new(Some(Arc::new(mock.clone()))),
        pool: Arc::new(mock.clone()),
        cancellation: cancellation.clone(),
    };
    lifecycle.stop_watcher().await.unwrap();
    assert!(!cancellation.requested());
    lifecycle.cancel_renders().await.unwrap();
    lifecycle.cancel_git().await.unwrap();
    lifecycle.shutdown_sidecars().await.unwrap();
    lifecycle.release().await.unwrap();
}
