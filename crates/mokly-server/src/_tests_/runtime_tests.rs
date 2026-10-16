//! Accept failures preserve the listener and shutdown remains ordered.

use std::io;
use std::sync::Arc;

use axum::Router;
use tokio::sync::watch;
use unimock::{MockFn, Unimock, matching};

use crate::accept::{AcceptPeriod, AcceptorMock, BackoffMock};
use crate::application::HttpApplicationMock;
use crate::runtime::{BoundServer, Listener};
use crate::shutdown::LifecycleMock;

#[tokio::test]
async fn connection_errors_continue_and_resource_errors_back_off_without_closing() {
    let (stop, receiver) = watch::channel(false);
    let mock = Unimock::new((
        HttpApplicationMock::router
            .next_call(matching!(_))
            .returns(Router::new()),
        AcceptorMock::accept
            .next_call(matching!())
            .returns(Err(io::ErrorKind::ConnectionAborted.into())),
        AcceptorMock::accept
            .next_call(matching!())
            .returns(Err(io::ErrorKind::ConnectionReset.into())),
        AcceptorMock::accept
            .next_call(matching!())
            .returns(Err(io::ErrorKind::Interrupted.into())),
        AcceptorMock::accept
            .next_call(matching!())
            .returns(Err(io::Error::from_raw_os_error(24))),
        HttpApplicationMock::accept_failed
            .next_call(matching!(_))
            .returns(()),
        BackoffMock::wait
            .each_call(matching!())
            .returns(())
            .n_times(2),
        AcceptorMock::accept
            .next_call(matching!())
            .returns(Err(io::Error::from_raw_os_error(24))),
        AcceptorMock::accept
            .next_call(matching!())
            .answers_arc(Arc::new(move |_| {
                stop.send_replace(true);
                Err(io::ErrorKind::Interrupted.into())
            })),
        LifecycleMock::stop_watcher
            .next_call(matching!())
            .returns(Ok(())),
        LifecycleMock::cancel_renders
            .next_call(matching!())
            .returns(Ok(())),
        HttpApplicationMock::stop_renders
            .next_call(matching!())
            .returns(()),
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
    let listener: Box<dyn BoundServer> = Box::new(Listener {
        socket: Arc::new(mock.clone()),
        backoff: Arc::new(mock.clone()),
        address: "127.0.0.1:4173".parse().unwrap(),
    });
    listener
        .run(Arc::new(mock.clone()), receiver, Arc::new(mock.clone()))
        .await
        .unwrap();
}

#[test]
fn a_backoff_period_reports_one_failure_and_one_recovery() {
    let mut period = AcceptPeriod::default();
    assert!(!period.recovered());
    for _ in 0..2 {
        assert!(period.failed());
        assert!(!period.failed());
        assert!(period.recovered());
        assert!(!period.recovered());
    }
}
