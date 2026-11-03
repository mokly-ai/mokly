//! Local recipe errors preserve healthy workers and recycling preserves results.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::methods::{Call, ModuleResolution, ProcessCss};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::Slot;
use crate::results::Css;
use crate::wire::MethodResult;
use crate::workers::{ControlMock, WorkerMock};

fn css() -> Call {
    Call::ProcessCss(ProcessCss {
        repository_roots: Vec::new(),
        context: "css".into(),
        source_root: "/repo".into(),
        module_resolution: ModuleResolution::default(),
        postcss: "config".into(),
        source_path: "x.css".into(),
        text: String::new(),
    })
}

fn pool(worker: Unimock, clock: Unimock) -> Pool {
    let pool = Pool::new(
        Arc::new(Unimock::new(())),
        Arc::new(clock),
        Launch {
            node: "node".into(),
            entry: "sidecar.js".into(),
            repository: "/repo".into(),
            version: "test".into(),
        },
        PoolOptions {
            size: 1.try_into().unwrap(),
            timeout_ms: None,
        },
    );
    {
        let mut state = pool.lock();
        state.slots.push(Some(Slot {
            source_root: "/repo".into(),
            worker: Box::new(worker.clone()),
            control: Arc::new(worker),
            generations: BTreeMap::new(),
            maps: BTreeSet::new(),
            described: BTreeSet::new(),
            bindings: BTreeMap::new(),
            contexts: BTreeSet::new(),
            renders: 0,
            requests: 1,
        }));
        state.available.push_back(0);
    }
    pool
}

fn result() -> MethodResult {
    MethodResult::Css(Css {
        read_evidence: Default::default(),
        unmapped_dependency_directories: None,
        text: "success".into(),
        dependencies: Vec::new(),
    })
}

#[test]
fn recycle_shutdown_failure_cannot_replace_a_successful_result() {
    let worker = Unimock::new((
        WorkerMock::request
            .next_call(matching!(_, 60_000))
            .returns(Ok(result())),
        WorkerMock::resident_bytes
            .next_call(matching!())
            .returns(Ok(1_073_741_825_u64)),
        ControlMock::shutdown
            .next_call(matching!())
            .returns(Err(Error::Crashed)),
        ControlMock::kill.next_call(matching!()).returns(Ok(())),
    ));
    let pool = pool(worker, Unimock::new(()));
    let MethodResult::Css(result) = pool.request(css()).unwrap() else {
        panic!()
    };
    assert_eq!(result.text, "success");
    assert!(pool.lock().slots[0].is_none());
}
