//! Startup shutdown uses every ordered hook and atomically blocks readiness.

use std::sync::{Arc, Mutex};

use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_server::shutdown::LifecycleMock;
use mokly_sidecar::pool::PoolMock;
use tokio::sync::watch;
use unimock::{MockFn, Unimock, matching};

use crate::serve_lifecycle::ServeLifecycle;
use crate::serve_shutdown::{self, Phase};
use crate::serve_watch::WatchInputsMock;

#[tokio::test]
async fn duplicate_stop_requests_stop_the_watcher_before_cancelling_startup() {
    let cancellation: Arc<dyn Cancellation> = Arc::new(ServeCancellation::default());
    let observed = cancellation.clone();
    let mock = Unimock::new((
        WatchInputsMock::stop
            .next_call(matching!())
            .answers_arc(Arc::new(move |_| {
                assert!(!observed.requested());
                Ok(())
            })),
        PoolMock::cancel_requests
            .next_call(matching!())
            .returns(Ok(())),
        PoolMock::shutdown.next_call(matching!()).returns(Ok(())),
    ));
    let lifecycle = Arc::new(ServeLifecycle {
        watch: Mutex::new(Some(Arc::new(mock.clone()))),
        cancellation: cancellation.clone(),
        pool: Arc::new(mock),
    });
    let phase = Arc::new(Phase::default());
    let (stop, receiver) = watch::channel(false);
    let shutdown = serve_shutdown::start(receiver, lifecycle, phase.clone());
    stop.send_replace(true);
    stop.send_replace(true);
    serve_shutdown::finish(shutdown.await).unwrap();
    assert!(cancellation.requested());
    for _ in 0..4 {
        assert!(
            !cancellation.interrupt(),
            "Serve never requests forced exit"
        );
    }
    assert!(
        !phase.serve(&|| {}),
        "a stop before the bind handoff forbids readiness"
    );
}
#[tokio::test]
async fn startup_runs_every_hook_in_order_and_serving_delegates_to_the_listener() {
    let hooks = Unimock::new((
        LifecycleMock::stop_watcher
            .next_call(matching!())
            .returns(Ok(())),
        LifecycleMock::cancel_renders
            .next_call(matching!())
            .returns(Ok(())),
        LifecycleMock::cancel_git
            .next_call(matching!())
            .returns(Ok(())),
        LifecycleMock::shutdown_sidecars
            .next_call(matching!())
            .returns(Ok(())),
        LifecycleMock::release
            .next_call(matching!())
            .returns(Ok(())),
    ));
    let (_, stopped) = watch::channel(true);
    serve_shutdown::finish(
        serve_shutdown::start(stopped, Arc::new(hooks), Arc::new(Phase::default())).await,
    )
    .unwrap();
    let phase = Arc::new(Phase::default());
    assert!(phase.serve(&|| {}));
    let (_, stopped) = watch::channel(true);
    serve_shutdown::finish(
        serve_shutdown::start(stopped, Arc::new(Unimock::new(())), phase.clone()).await,
    )
    .unwrap();
    assert!(!phase.serve(&|| {}));
}
