//! Stop failures retain error status and startup without a process emits no stop.

use std::sync::Arc;

use mokly_sidecar::error::Error;
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::{ClockMock, ControlMock, FactoryMock, WorkerMock};
use unimock::{MockFn, Unimock, matching};

use super::super::serve_trace_tests::capture;
use super::support::{call, factory, healthy, pair, pool, private_fields_absent, spawned, stage};

#[derive(Clone, Copy)]
enum Failure {
    Shutdown,
    Finish,
    FallbackKill,
}

#[test]
fn policy_stop_errors_survive_successful_fallback_kill() {
    for failure in [Failure::Shutdown, Failure::Finish, Failure::FallbackKill] {
        let common = (
            WorkerMock::handshake
                .next_call(matching!(30_000))
                .returns(Ok(())),
            WorkerMock::request
                .each_call(matching!(_, 60_000))
                .answers(&|_, _, _| Ok(MethodResult::Empty))
                .n_times(2),
            WorkerMock::resident_bytes
                .each_call(matching!())
                .answers(&|_| Ok(1_073_741_825u64))
                .n_times(2),
        );
        let worker = match failure {
            Failure::Shutdown => Unimock::new((
                common,
                ControlMock::shutdown
                    .next_call(matching!())
                    .returns(Err(Error::Crashed)),
                ControlMock::kill.next_call(matching!()).returns(Ok(())),
            )),
            Failure::Finish | Failure::FallbackKill => Unimock::new((
                common,
                ControlMock::shutdown.next_call(matching!()).returns(Ok(())),
                ControlMock::finish
                    .next_call(matching!(2_000))
                    .returns(Err(Error::Crashed)),
                ControlMock::kill.next_call(matching!()).returns(
                    if matches!(failure, Failure::FallbackKill) {
                        Err(Error::Crashed)
                    } else {
                        Ok(())
                    },
                ),
            )),
        };
        let factory = factory(&[&worker]);
        let clock = if matches!(failure, Failure::Shutdown) {
            Unimock::new(())
        } else {
            Unimock::new(ClockMock::now_ms.next_call(matching!()).returns(0u64))
        };
        let records = capture(|| {
            let caller = tracing::info_span!("css.postcss");
            let _scope = caller.enter();
            let pool = pool(&factory, &clock);
            for _ in 0..2 {
                pool.request(call("/private-root")).unwrap();
            }
        });
        pair(
            &stage(&records, "sidecar.stop"),
            "recycle",
            &records[0],
            "error",
        );
        assert!(stage(&records, "sidecar.recycle").is_empty());
        private_fields_absent(&records);
    }
}

#[test]
fn forced_kill_failure_keeps_the_original_returned_error_without_retry() {
    let worker = Unimock::new((
        WorkerMock::handshake
            .next_call(matching!(30_000))
            .returns(Ok(())),
        WorkerMock::request
            .next_call(matching!(_, 60_000))
            .returns(Err(Error::Crashed)),
        ControlMock::kill
            .next_call(matching!())
            .returns(Err(Error::Unavailable {
                part: "private-kill".into(),
            })),
    ));
    let factory = factory(&[&worker]);
    let clock = Unimock::new(());
    let records = capture(|| {
        let caller = tracing::info_span!("css.postcss", status = "error");
        let _scope = caller.enter();
        let pool = pool(&factory, &clock);
        assert!(matches!(
            pool.request(call("/private-root")),
            Err(Error::Unavailable { .. })
        ));
    });
    pair(
        &stage(&records, "sidecar.stop"),
        "replacement",
        &records[0],
        "error",
    );
    assert_eq!(stage(&records, "sidecar.spawn").len(), 2);
    private_fields_absent(&records);
}

#[test]
fn failed_factory_attempt_emits_no_stop_and_next_attempt_has_retry_reason() {
    let worker = healthy(true);
    let process = worker.clone();
    let factory = Unimock::new((
        FactoryMock::spawn
            .next_call(matching!(_))
            .answers(&|_, _| Err(Error::Crashed)),
        FactoryMock::spawn
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(spawned(&process)))),
    ));
    let clock = Unimock::new(ClockMock::now_ms.next_call(matching!()).returns(0u64));
    let records = capture(|| {
        let caller = tracing::info_span!("css.postcss");
        let _scope = caller.enter();
        let pool = pool(&factory, &clock);
        pool.request(call("/private-root")).unwrap();
        pool.shutdown().unwrap();
    });
    assert!(stage(&records, "sidecar.stop").is_empty());
    pair(
        &stage(&records, "sidecar.recycle"),
        "retry",
        &records[0],
        "ok",
    );
    let spawns = stage(&records, "sidecar.spawn");
    assert_eq!(spawns.len(), 4);
    assert_eq!(spawns[1]["status"], "error");
    assert_eq!(spawns[3]["status"], "ok");
    private_fields_absent(&records);
}

#[test]
fn stop_without_caller_omits_parent_and_free_form_reason_is_excluded() {
    let records = capture(|| {
        {
            let span =
                tracing::info_span!("sidecar.stop", reason = "replacement", status = "error");
            let _scope = span.enter();
            span.record("status", "ok");
        }
        let span = tracing::info_span!(
            "sidecar.stop",
            reason = "private-authored-text",
            status = "error"
        );
        let _scope = span.enter();
    });
    assert_eq!(records.len(), 4);
    assert!(
        records
            .iter()
            .all(|record| record.get("parentId").is_none())
    );
    assert_eq!(records[0]["reason"], "replacement");
    assert_eq!(records[1]["reason"], "replacement");
    assert_eq!(records[1]["status"], "ok");
    assert_eq!(records[3]["status"], "error");
    assert!(
        records[2..]
            .iter()
            .all(|record| record.get("reason").is_none())
    );
    private_fields_absent(&records);
}
