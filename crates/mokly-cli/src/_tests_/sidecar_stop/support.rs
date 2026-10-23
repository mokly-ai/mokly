//! Original mocks stay on the test thread; workers and pool fields hold clones.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use mokly_sidecar::methods::{Call, ModuleResolution, ProcessCss};
use mokly_sidecar::pool::Pool;
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::{ControlMock, FactoryMock, Spawned, WorkerMock};
use serde_json::Value;
use unimock::{MockFn, Unimock, matching};

pub(super) fn pool(factory: &Unimock, clock: &Unimock) -> Pool {
    Pool::new(
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
    )
}

pub(super) fn spawned(mock: &Unimock) -> Spawned {
    Spawned {
        worker: Box::new(mock.clone()),
        control: Arc::new(mock.clone()),
    }
}

pub(super) fn factory(workers: &[&Unimock]) -> Unimock {
    let count = workers.len();
    let processes = Mutex::new(
        workers
            .iter()
            .map(|mock| spawned(mock))
            .collect::<VecDeque<_>>(),
    );
    Unimock::new(
        FactoryMock::spawn
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(processes.lock().unwrap().pop_front().unwrap())
            }))
            .n_times(count),
    )
}

pub(super) fn healthy(memory_sample: bool) -> Unimock {
    let common = (
        WorkerMock::handshake
            .next_call(matching!(30_000))
            .returns(Ok(())),
        WorkerMock::request
            .next_call(matching!(_, 60_000))
            .returns(Ok(MethodResult::Empty)),
    );
    let cleanup = (
        ControlMock::shutdown.next_call(matching!()).returns(Ok(())),
        ControlMock::finish
            .next_call(matching!(2_000))
            .returns(Ok(())),
    );
    if memory_sample {
        Unimock::new((
            common,
            WorkerMock::resident_bytes
                .next_call(matching!())
                .returns(Ok(0)),
            cleanup,
        ))
    } else {
        Unimock::new((common, cleanup))
    }
}

pub(super) fn call(root: &str) -> Call {
    Call::ProcessCss(ProcessCss {
        repository_roots: Vec::new(),
        context: "private-context".into(),
        source_root: root.into(),
        module_resolution: ModuleResolution::default(),
        postcss: "private-config".into(),
        source_path: "private-path".into(),
        text: "private-text".into(),
    })
}

pub(super) fn stage<'a>(records: &'a [Value], name: &str) -> Vec<&'a Value> {
    records
        .iter()
        .filter(|record| record["stage"] == name)
        .collect()
}

pub(super) fn pair(records: &[&Value], reason: &str, parent: &Value, status: &str) {
    assert_eq!(records.len(), 2);
    assert_eq!(records[0]["event"], "start");
    assert_eq!(records[1]["event"], "end");
    assert_eq!(records[0]["id"], records[1]["id"]);
    assert_eq!(records[1]["status"], status);
    assert_eq!(records[1]["durationMs"], 0);
    for record in records {
        assert_eq!(record["reason"], reason);
        assert_eq!(record["parentId"], parent["id"]);
        assert_eq!(record["schemaVersion"], 1);
    }
}

pub(super) fn private_fields_absent(records: &[Value]) {
    assert!(
        records
            .iter()
            .all(|record| !record.to_string().contains("private"))
    );
}
