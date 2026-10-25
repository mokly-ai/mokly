//! Accept failures preserve the listener and shutdown remains ordered.

use std::io;
use std::sync::Arc;

use axum::Router;
use tokio::sync::watch;
use unimock::{MockFn, Unimock, matching};

use crate::accept::{AcceptPeriod, Acceptor, AcceptorMock, BackoffMock};
use crate::application::HttpApplicationMock;
use crate::error::InternalError;
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

#[tokio::test]
async fn run_releases_the_listener_after_cleanup_also_when_a_hook_fails() {
    for failed_hook in [false, true] {
        let (stop, receiver) = watch::channel(false);
        let acceptor = Unimock::new(AcceptorMock::accept.next_call(matching!()).answers_arc(
            Arc::new(move |_| {
                stop.send_replace(true);
                Err(io::ErrorKind::Interrupted.into())
            }),
        ));
        let socket: Arc<dyn Acceptor> = Arc::new(acceptor.clone());
        let released = Arc::downgrade(&socket);
        let during_release = released.clone();
        let watcher_result = if failed_hook {
            Err(InternalError::Io {
                source: io::Error::other("fixture failure"),
            }
            .into())
        } else {
            Ok(())
        };
        let mock = Unimock::new((
            HttpApplicationMock::router
                .next_call(matching!(_))
                .returns(Router::new()),
            LifecycleMock::stop_watcher
                .next_call(matching!())
                .returns(watcher_result),
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
                .answers_arc(Arc::new(move |_| {
                    assert!(during_release.upgrade().is_some());
                    Ok(())
                })),
        ));
        let listener: Box<dyn BoundServer> = Box::new(Listener {
            socket,
            backoff: Arc::new(Unimock::new(())),
            address: "127.0.0.1:4173".parse().unwrap(),
        });
        assert!(released.upgrade().is_some());
        let result = listener
            .run(Arc::new(mock.clone()), receiver, Arc::new(mock.clone()))
            .await;
        assert_eq!(result.is_err(), failed_hook, "{result:?}");
        assert!(released.upgrade().is_none());
    }
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
