//! Stop and later spawn belong to separate callers without keeping the old parent alive.

use mokly_sidecar::error::{Error, ProtocolError};
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::{ClockMock, ControlMock, WorkerMock};
use unimock::{MockFn, Unimock, matching};

use super::super::serve_trace_tests::capture;
use super::support::{call, factory, healthy, pair, pool, private_fields_absent, stage};

#[test]
fn policy_stop_keeps_first_caller_and_empty_root_switch_keeps_recycle_reason() {
    let first = Unimock::new((
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
        ControlMock::shutdown.next_call(matching!()).returns(Ok(())),
        ControlMock::finish
            .next_call(matching!(2_000))
            .returns(Ok(())),
    ));
    let second = healthy(false);
    let factory = factory(&[&first, &second]);
    let clock = Unimock::new(
        ClockMock::now_ms
            .each_call(matching!())
            .returns(0u64)
            .n_times(2),
    );
    let records = capture(|| {
        let pool = pool(&factory, &clock);
        {
            let caller = tracing::info_span!("render.fragment");
            let _scope = caller.enter();
            for _ in 0..2 {
                pool.request(call("/private-root")).unwrap();
            }
        }
        {
            let caller = tracing::info_span!("css.postcss");
            let _scope = caller.enter();
            pool.request(call("/private-other-root")).unwrap();
        }
        pool.shutdown().unwrap();
    });
    let first_caller = stage(&records, "render.fragment");
    let second_caller = stage(&records, "css.postcss");
    pair(
        &stage(&records, "sidecar.stop"),
        "recycle",
        first_caller[0],
        "ok",
    );
    let replacement = stage(&records, "sidecar.recycle");
    pair(&replacement, "recycle", second_caller[0], "ok");
    assert_eq!(
        stage(&records, "sidecar.spawn")[2]["parentId"],
        replacement[0]["id"]
    );
    let first_end = records
        .iter()
        .position(|r| r["stage"] == "render.fragment" && r["event"] == "end")
        .unwrap();
    let second_start = records
        .iter()
        .position(|r| r["stage"] == "css.postcss" && r["event"] == "start")
        .unwrap();
    assert!(first_end < second_start);
    private_fields_absent(&records);
}

#[test]
fn live_root_switch_stops_under_the_selecting_caller() {
    let first = Unimock::new((
        WorkerMock::handshake
            .next_call(matching!(30_000))
            .returns(Ok(())),
        WorkerMock::request
            .next_call(matching!(_, 60_000))
            .returns(Ok(MethodResult::Empty)),
        WorkerMock::resident_bytes
            .next_call(matching!())
            .returns(Ok(0)),
        ControlMock::kill.next_call(matching!()).returns(Ok(())),
    ));
    let second = healthy(true);
    let factory = factory(&[&first, &second]);
    let clock = Unimock::new(ClockMock::now_ms.next_call(matching!()).returns(0u64));
    let records = capture(|| {
        let pool = pool(&factory, &clock);
        pool.request(call("/private-root")).unwrap();
        {
            let caller = tracing::info_span!("css.postcss");
            let _scope = caller.enter();
            pool.request(call("/private-other-root")).unwrap();
        }
        pool.shutdown().unwrap();
    });
    let caller = stage(&records, "css.postcss");
    pair(
        &stage(&records, "sidecar.stop"),
        "root-switch",
        caller[0],
        "ok",
    );
    pair(
        &stage(&records, "sidecar.recycle"),
        "root-switch",
        caller[0],
        "ok",
    );
    private_fields_absent(&records);
}

#[test]
fn failed_request_stop_succeeds_and_later_spawn_keeps_its_own_caller() {
    let first = Unimock::new((
        WorkerMock::handshake
            .next_call(matching!(30_000))
            .returns(Ok(())),
        WorkerMock::request
            .next_call(matching!(_, 60_000))
            .returns(Err(Error::Protocol(ProtocolError::Handshake))),
        ControlMock::kill.next_call(matching!()).returns(Ok(())),
    ));
    let second = healthy(true);
    let factory = factory(&[&first, &second]);
    let clock = Unimock::new(ClockMock::now_ms.next_call(matching!()).returns(0u64));
    let records = capture(|| {
        let pool = pool(&factory, &clock);
        {
            let caller = tracing::info_span!("render.fragment", status = "error");
            let _scope = caller.enter();
            assert!(matches!(
                pool.request(call("/private-root")),
                Err(Error::Protocol(_))
            ));
        }
        {
            let caller = tracing::info_span!("css.postcss");
            let _scope = caller.enter();
            pool.request(call("/private-root")).unwrap();
        }
        pool.shutdown().unwrap();
    });
    let first_caller = stage(&records, "render.fragment");
    pair(
        &stage(&records, "sidecar.stop"),
        "replacement",
        first_caller[0],
        "ok",
    );
    assert_eq!(first_caller[1]["status"], "error");
    pair(
        &stage(&records, "sidecar.recycle"),
        "replacement",
        stage(&records, "css.postcss")[0],
        "ok",
    );
    private_fields_absent(&records);
}
