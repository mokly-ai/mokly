//! Repeated Serve stop sources drain the shared pool once and never force exit.

use std::sync::Arc;
use std::sync::atomic::AtomicBool;

use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_sidecar::pool::PoolMock;
use tokio::sync::watch;
use unimock::{MockFn, Unimock, matching};

use crate::serve_shutdown;

#[tokio::test]
async fn duplicate_stop_requests_cancel_work_and_shutdown_once() {
    let cancellation: Arc<dyn Cancellation> = Arc::new(ServeCancellation::default());
    let mock = Unimock::new((
        PoolMock::cancel_requests
            .next_call(matching!())
            .returns(Ok(())),
        PoolMock::shutdown.next_call(matching!()).returns(Ok(())),
    ));
    let pool = Arc::new(mock.clone());
    let (stop, receiver) = watch::channel(false);
    let shutdown = serve_shutdown::start(
        receiver,
        cancellation.clone(),
        pool,
        Arc::new(AtomicBool::new(false)),
    );
    assert!(!cancellation.requested());
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
}
