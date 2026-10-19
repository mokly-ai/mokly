//! Native worker spans and raw forwarding use fake processes and a fixed clock.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::thread;

use mokly_cli::redaction::Redactor;
use mokly_sidecar::bindings::DisposeContext;
use mokly_sidecar::error::Error;
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::{ClockMock, ControlMock, FactoryMock, Spawned, WorkerMock};
use unimock::{MockFn, Unimock, matching};

use super::serve_trace_tests::{capture, capture_lines, capture_redacted};

#[test]
fn sidecar_timing_lines_keep_their_original_bytes_and_identity() {
    let raw = "[mokly:timing] { \"role\":\"sidecar\", \"session\":\"child\", \"pid\":123, \"event\":\"start\" }";
    let lines = capture_lines(|| tracing::info!(sidecar_timing = raw, "sidecar timing"));
    assert_eq!(lines, [format!("{raw}\n")]);
}

#[test]
fn record_shaped_diagnostics_cannot_bypass_token_or_control_redaction() {
    let raw = "[mokly:timing] {\r\"role\":\"sidecar\",\"session\":\"private/token\",\"label\":\"private%2Ftoken\u{7f}\u{85}\"}";
    let lines = capture_redacted(
        || tracing::info!(sidecar_timing = raw, "sidecar timing"),
        Redactor::collect(&[], Some("private/token")),
    );
    assert_eq!(
        lines,
        [
            "[mokly:timing] {\\u000d\"role\":\"sidecar\",\"session\":\"[redacted]\",\"label\":\"[redacted]\\u007f\\u0085\"}\n"
        ]
    );
}

fn spawned(mock: &Unimock) -> Spawned {
    Spawned {
        worker: Box::new(mock.clone()),
        control: Arc::new(mock.clone()),
    }
}

#[test]
fn spawned_mock_keeps_verification_on_its_owner_thread() {
    let mock = Unimock::new(ControlMock::shutdown.next_call(matching!()).returns(Ok(())));
    let process = spawned(&mock);
    thread::spawn(move || {
        let process = process;
        process.control.shutdown().unwrap();
    })
    .join()
    .unwrap();
}

#[test]
fn spawn_and_replacement_cover_hello_and_keep_error_until_success() {
    for success in [false, true] {
        let first = Unimock::new((
            WorkerMock::handshake
                .next_call(matching!(30_000))
                .returns(Err(Error::Crashed)),
            ControlMock::kill.next_call(matching!()).returns(Ok(())),
        ));
        let second = if success {
            Unimock::new((
                WorkerMock::handshake
                    .next_call(matching!(30_000))
                    .returns(Ok(())),
                WorkerMock::request
                    .next_call(matching!(_, 30_000))
                    .returns(Ok(MethodResult::Empty)),
                WorkerMock::resident_bytes
                    .next_call(matching!())
                    .returns(Ok(0)),
                ControlMock::shutdown.next_call(matching!()).returns(Ok(())),
                ControlMock::finish
                    .next_call(matching!(2_000))
                    .returns(Ok(())),
            ))
        } else {
            Unimock::new((
                WorkerMock::handshake
                    .next_call(matching!(30_000))
                    .returns(Err(Error::Version {
                        expected: "test".into(),
                        actual: "wrong".into(),
                    })),
                ControlMock::kill.next_call(matching!()).returns(Ok(())),
            ))
        };
        let processes = Mutex::new(VecDeque::from([spawned(&first), spawned(&second)]));
        let factory = Unimock::new(
            FactoryMock::spawn
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    Ok(processes.lock().unwrap().pop_front().unwrap())
                }))
                .n_times(2),
        );
        let clock = if success {
            Unimock::new(ClockMock::now_ms.each_call(matching!()).returns(0u64))
        } else {
            Unimock::new(())
        };
        let records = capture(|| {
            let outer = tracing::info_span!("output.write", status = "ok");
            let _scope = outer.enter();
            let pool = Pool::new(
                Arc::new(factory.clone()),
                Arc::new(clock.clone()),
                Launch {
                    node: "private-node".into(),
                    entry: "private-entry".into(),
                    repository: "/private-root".into(),
                    version: "test".into(),
                },
                PoolOptions {
                    size: 1.try_into().unwrap(),
                    timeout_ms: None,
                },
            );
            let result = pool.request(Call::DisposeContext(DisposeContext {
                context: "private-context".into(),
            }));
            assert_eq!(result.is_ok(), success);
            if success {
                pool.shutdown().unwrap();
            }
        });
        let spawns: Vec<_> = records
            .iter()
            .filter(|record| record["stage"] == "sidecar.spawn")
            .collect();
        assert_eq!(spawns.len(), 4);
        assert_eq!(spawns[1]["status"], "error");
        assert_eq!(spawns[3]["status"], if success { "ok" } else { "error" });
        let recycle: Vec<_> = records
            .iter()
            .filter(|record| record["stage"] == "sidecar.recycle")
            .collect();
        assert_eq!(recycle.len(), 2);
        assert!(recycle.iter().all(|record| record["reason"] == "retry"));
        assert_eq!(recycle[1]["status"], if success { "ok" } else { "error" });
        assert_eq!(spawns[0]["parentId"], records[0]["id"]);
        assert_eq!(recycle[0]["parentId"], records[0]["id"]);
        assert_eq!(spawns[2]["parentId"], recycle[0]["id"]);
        let stops: Vec<_> = records
            .iter()
            .filter(|record| record["stage"] == "sidecar.stop")
            .collect();
        assert_eq!(stops.len(), if success { 2 } else { 4 });
        for (index, pair) in stops.chunks_exact(2).enumerate() {
            assert_eq!(pair[0]["event"], "start");
            assert_eq!(pair[1]["event"], "end");
            assert_eq!(pair[0]["id"], pair[1]["id"]);
            assert_eq!(pair[1]["status"], "ok");
            assert_eq!(pair[1]["durationMs"], 0);
            for record in pair {
                assert_eq!(record["reason"], "retry");
                assert_eq!(record["parentId"], spawns[index * 2]["id"]);
            }
        }
        assert!(
            records
                .iter()
                .all(|record| !record.to_string().contains("private"))
        );
    }
}
