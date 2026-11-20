//! Regressions for reserved listener ownership and server failure cleanup.

use std::io::ErrorKind;
use std::net::TcpListener;
use std::sync::mpsc;

use crate::test_server::{BoundListener, ServerThread};

#[test]
fn bound_api_listener_reserves_its_address_before_serving() {
    let listener = BoundListener::bind();
    assert_eq!(
        TcpListener::bind(listener.address).unwrap_err().kind(),
        ErrorKind::AddrInUse
    );
}

#[test]
#[should_panic(expected = "immediate API server failure")]
fn immediate_server_failure_survives_cleanup_while_unwinding() {
    let (stop, stopped) = mpsc::channel();
    let _dependency = ServerThread::spawn(
        "Stripe",
        move || {
            let _ = stop.send(());
        },
        move || {
            stopped.recv().unwrap();
            panic!("Stripe failed during API cleanup");
        },
    );
    let (started, running) = mpsc::channel();
    let server = ServerThread::spawn(
        "API",
        || {},
        move || {
            started.send(()).unwrap();
            panic!("immediate API server failure");
        },
    );
    running.recv().unwrap();
    server.wait_until_ready(&mut || false);
}
