//! Pool orchestration uses mocked processes and a controlled monotonic clock.

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::error::{Error, ProtocolError};
use crate::methods::{Call, ModuleResolution, ProcessCss};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::results::Css;
use crate::wire::MethodResult;
use crate::workers::{ClockMock, ControlMock, FactoryMock, Spawned, WorkerMock};

fn launch() -> Launch {
    Launch {
        node: "node".into(),
        entry: "sidecar.js".into(),
        repository: "/repo".into(),
        version: "test".into(),
    }
}

fn call() -> Call {
    Call::ProcessCss(ProcessCss {
        context: "css".into(),
        source_root: "/repo".into(),
        module_resolution: ModuleResolution::default(),
        postcss: "postcss.mjs".into(),
        source_path: "x.css".into(),
        text: "a{}".into(),
    })
}

fn css() -> MethodResult {
    MethodResult::Css(Css {
        text: "a{}".into(),
        dependencies: Vec::new(),
    })
}

#[test]
fn pool_is_lazy_and_shutdown_prevents_new_work() {
    let mock = Unimock::new(ClockMock::now_ms.next_call(matching!()).returns(100_u64));
    let pool: Box<dyn SidecarPool> = Box::new(Pool::new(
        Arc::new(mock.clone()),
        Arc::new(mock),
        launch(),
        PoolOptions {
            size: 4.try_into().unwrap(),
            timeout_ms: None,
        },
    ));
    pool.shutdown().unwrap();
    assert!(matches!(pool.request(call()), Err(Error::Cancelled)));
}

#[test]
fn a_timeout_kills_and_retries_once_on_a_fresh_process() {
    let first = Unimock::new((
        WorkerMock::handshake
            .next_call(matching!(71))
            .returns(Ok(())),
        WorkerMock::request
            .next_call(matching!(_, 71))
            .returns(Err(Error::Timeout { deadline_ms: 71 })),
        ControlMock::kill.next_call(matching!()).returns(Ok(())),
    ));
    let second = Unimock::new((
        WorkerMock::handshake
            .next_call(matching!(71))
            .returns(Ok(())),
        WorkerMock::request
            .next_call(matching!(_, 71))
            .returns(Ok(css())),
        WorkerMock::resident_bytes
            .next_call(matching!())
            .returns(Ok(0)),
        ControlMock::shutdown.next_call(matching!()).returns(Ok(())),
        ControlMock::finish
            .next_call(matching!(2_123))
            .returns(Ok(())),
    ));
    let first_process = std::sync::Mutex::new(Some(Spawned {
        worker: Box::new(first.clone()),
        control: Arc::new(first),
    }));
    let second_process = std::sync::Mutex::new(Some(Spawned {
        worker: Box::new(second.clone()),
        control: Arc::new(second),
    }));
    let factory = Unimock::new((
        FactoryMock::spawn
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(first_process.lock().unwrap().take().unwrap())
            })),
        FactoryMock::spawn
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(second_process.lock().unwrap().take().unwrap())
            })),
        ClockMock::now_ms.next_call(matching!()).returns(123_u64),
    ));
    let pool = Pool::new(
        Arc::new(factory.clone()),
        Arc::new(factory),
        launch(),
        PoolOptions {
            size: 1.try_into().unwrap(),
            timeout_ms: Some(71),
        },
    );
    assert!(matches!(
        pool.request(call()).unwrap(),
        MethodResult::Css(_)
    ));
    pool.shutdown().unwrap();
}

#[test]
fn second_timeout_fails_and_protocol_failures_are_not_retried() {
    for protocol in [false, true] {
        let build = || {
            let mock = Unimock::new((
                WorkerMock::handshake
                    .next_call(matching!(30_000))
                    .returns(Ok(())),
                WorkerMock::request
                    .next_call(matching!(_, 60_000))
                    .returns(Err(if protocol {
                        Error::Protocol(ProtocolError::Truncated)
                    } else {
                        Error::Timeout {
                            deadline_ms: 60_000,
                        }
                    })),
                ControlMock::kill.next_call(matching!()).returns(Ok(())),
            ));
            Spawned {
                worker: Box::new(mock.clone()),
                control: Arc::new(mock),
            }
        };
        let first_process = std::sync::Mutex::new(Some(build()));
        let first = FactoryMock::spawn
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(first_process.lock().unwrap().take().unwrap())
            }));
        let factory = if protocol {
            Unimock::new(first)
        } else {
            {
                let process = std::sync::Mutex::new(Some(build()));
                Unimock::new((
                    first,
                    FactoryMock::spawn
                        .next_call(matching!(_))
                        .answers_arc(Arc::new(move |_, _| {
                            Ok(process.lock().unwrap().take().unwrap())
                        })),
                ))
            }
        };
        let pool = Pool::new(
            Arc::new(factory.clone()),
            Arc::new(factory),
            launch(),
            PoolOptions {
                size: 1.try_into().unwrap(),
                timeout_ms: None,
            },
        );
        if protocol {
            assert!(matches!(pool.request(call()), Err(Error::Protocol(_))));
        } else {
            assert!(matches!(
                pool.request(call()),
                Err(Error::RequestTimeout { deadline_ms:60_000, call }) if call.to_string() == "postcss.mjs for x.css"
            ));
        }
    }
}
