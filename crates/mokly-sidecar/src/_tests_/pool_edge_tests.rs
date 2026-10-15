//! Local recipe errors preserve healthy workers and recycling preserves results.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::methods::{Bundle, Call, Generation, ModuleResolution, ProcessCss, RenderPage};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::Slot;
use crate::results::{self, Css};
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
        let mut state = pool.lock().unwrap();
        state.slots.push(Some(Slot {
            worker: Box::new(worker.clone()),
            control: Arc::new(worker),
            generations: BTreeMap::new(),
            maps: BTreeSet::new(),
            described: BTreeSet::new(),
            bindings: BTreeMap::new(),
            contexts: BTreeSet::new(),
            renders: 0,
        }));
        state.available.push_back(0);
    }
    pool
}

fn result() -> MethodResult {
    MethodResult::Css(Css {
        text: "success".into(),
        dependencies: Vec::new(),
    })
}

#[test]
fn an_unknown_generation_does_not_kill_a_healthy_process() {
    let worker = Unimock::new((
        WorkerMock::request
            .next_call(matching!(_, 60_000))
            .returns(Ok(result())),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0))
            .n_times(2),
    ));
    let pool = pool(worker, Unimock::new(()));
    assert!(matches!(
        pool.request(Call::Describe(Generation {
            generation: "missing".into()
        })),
        Err(Error::UnknownGeneration { .. })
    ));
    assert!(matches!(pool.request(css()).unwrap(), MethodResult::Css(_)));
}

#[test]
fn a_changed_generation_does_not_kill_a_healthy_process() {
    let worker = Unimock::new((
        WorkerMock::request
            .next_call(matching!((request,_) if matches!(request.call,Call::Bundle(_))))
            .returns(Ok(MethodResult::Bundle(results::Bundle {
                generation: "changed".into(),
                modules: Vec::new(),
                warnings: Vec::new(),
            }))),
        WorkerMock::request.next_call(matching!((request,_) if matches!(&request.call,Call::Dispose(value) if value.generation == "changed"))).returns(Ok(MethodResult::Empty)),
        WorkerMock::request
            .next_call(matching!((request,_) if matches!(request.call,Call::ProcessCss(_))))
            .returns(Ok(result())),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0))
            .n_times(2),
    ));
    let pool = pool(worker, Unimock::new(()));
    pool.lock().unwrap().bundles.insert(
        "g".into(),
        Bundle {
            entry_files: Vec::new(),
            renderer: None,
            stories_files: Vec::new(),
            module_resolution: ModuleResolution::default(),
            source_root: "/repo".into(),
            configuration_directory: ".".into(),
            repository_roots: Vec::new(),
        },
    );
    assert!(matches!(
        pool.request(Call::RenderPage(RenderPage {
            generation: "g".into(),
            handle: "entry#default".into()
        })),
        Err(Error::GenerationChanged { .. })
    ));
    assert!(matches!(pool.request(css()).unwrap(), MethodResult::Css(_)));
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
    assert!(pool.lock().unwrap().slots[0].is_none());
}
