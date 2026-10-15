//! Render and resident-set boundaries use operation counts, not wall time.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::methods::{Bundle, Call, ModuleResolution, ProcessCss, RenderPage};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::Slot;
use crate::results::Page;
use crate::wire::MethodResult;
use crate::workers::{ClockMock, ControlMock, WorkerMock};

fn pool(mock: Unimock) -> Pool {
    Pool::new(
        Arc::new(Unimock::new(())),
        Arc::new(mock),
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
    )
}

fn seed(pool: &Pool, worker: Unimock) {
    let mut state = pool.lock().unwrap();
    let request_worker = worker.clone();
    let control = Arc::new(worker);
    state.slots.push(Some(Slot {
        worker: Box::new(request_worker),
        control: control.clone(),
        generations: BTreeMap::from([("g".into(), 0)]),
        maps: BTreeSet::from(["g".into()]),
        described: BTreeSet::from(["g".into()]),
        bindings: BTreeMap::new(),
        contexts: BTreeSet::new(),
        renders: 0,
    }));
    state.available.push_back(0);
    state.controls.insert(0, control);
    state.bundles.insert(
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
}

#[test]
fn render_500_recycles_after_the_inflight_result_returns() {
    let worker = Unimock::new((
        WorkerMock::request
            .each_call(matching!(_, 30_000))
            .answers(&|_, _, _| {
                Ok(MethodResult::Page(Page {
                    html: "document".into(),
                    resources: Vec::new(),
                    warnings: Vec::new(),
                }))
            })
            .n_times(500),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0))
            .n_times(500),
        ControlMock::shutdown.next_call(matching!()).returns(Ok(())),
        ControlMock::finish
            .next_call(matching!(2_100))
            .returns(Ok(())),
    ));
    let pool = pool(Unimock::new(
        ClockMock::now_ms.next_call(matching!()).returns(100_u64),
    ));
    seed(&pool, worker);
    for _ in 0..499 {
        assert!(matches!(
            pool.request(Call::RenderPage(RenderPage {
                generation: "g".into(),
                handle: "x#page".into()
            }))
            .unwrap(),
            MethodResult::Page(_)
        ));
    }
    assert_eq!(pool.lock().unwrap().slots[0].as_ref().unwrap().renders, 499);
    pool.request(Call::RenderPage(RenderPage {
        generation: "g".into(),
        handle: "x#page".into(),
    }))
    .unwrap();
    assert!(pool.lock().unwrap().slots[0].is_none());
}

#[test]
fn resident_set_recycles_only_after_one_gib_is_exceeded() {
    let worker = Unimock::new((
        WorkerMock::request
            .each_call(matching!(_, 60_000))
            .answers(&|_, _, _| Ok(MethodResult::Empty))
            .n_times(2),
        WorkerMock::resident_bytes
            .next_call(matching!())
            .returns(Ok(1_073_741_824_u64)),
        WorkerMock::resident_bytes
            .next_call(matching!())
            .returns(Ok(1_073_741_825_u64)),
        ControlMock::shutdown.next_call(matching!()).returns(Ok(())),
        ControlMock::finish
            .next_call(matching!(2_100))
            .returns(Ok(())),
    ));
    let pool = pool(Unimock::new(
        ClockMock::now_ms.next_call(matching!()).returns(100_u64),
    ));
    seed(&pool, worker);
    let call = || {
        Call::ProcessCss(ProcessCss {
            repository_roots: Vec::new(),
            context: "css".into(),
            source_root: "/repo".into(),
            module_resolution: ModuleResolution::default(),
            postcss: "config".into(),
            source_path: "source".into(),
            text: String::new(),
        })
    };
    pool.request(call()).unwrap();
    assert!(pool.lock().unwrap().slots[0].is_some());
    pool.request(call()).unwrap();
    assert!(pool.lock().unwrap().slots[0].is_none());
}
