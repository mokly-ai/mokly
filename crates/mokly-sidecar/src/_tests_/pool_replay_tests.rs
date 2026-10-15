//! Prepared generations replay each prerequisite with its own method deadline.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::definitions::Definitions;
use crate::methods::{Bundle, Call, CssModules, Generation, ModuleResolution, RenderPage};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::Slot;
use crate::results::{self, Page};
use crate::wire::MethodResult;

use crate::workers::WorkerMock;

fn definitions() -> MethodResult {
    MethodResult::Definitions(Definitions {
        screens: Vec::new(),
        pages: Vec::new(),
        use_cases: Vec::new(),
        folders: Vec::new(),
        components: Vec::new(),
        stories: Vec::new(),
        diagnostics: Vec::new(),
    })
}

fn seed(worker: Unimock, loaded: bool) -> Pool {
    let pool = Pool::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Launch {
            node: "node".into(),
            entry: "sidecar.js".into(),
            repository: "/repo".into(),
            version: "test".into(),
        },
        PoolOptions {
            size: 1,
            timeout_ms: None,
        },
    );
    {
        let mut state = pool.lock().unwrap();
        state.slots.push(Some(Slot {
            worker: Box::new(worker.clone()),
            control: Arc::new(worker),
            generations: if loaded {
                BTreeSet::from(["g".into()])
            } else {
                BTreeSet::new()
            },
            maps: BTreeSet::new(),
            described: BTreeSet::new(),
            renders: 0,
        }));
        state.available.push_back(0);
        state.bundles.insert(
            "g".into(),
            Bundle {
                entry_files: vec!["entry.ts".into()],
                renderer: None,
                stories_files: Vec::new(),
                module_resolution: ModuleResolution::default(),
                source_root: "/repo".into(),
            },
        );
        state.maps.insert(
            "g".into(),
            CssModules {
                generation: "g".into(),
                class_maps: BTreeMap::new(),
            },
        );
    }
    pool
}

#[test]
fn maps_installed_on_another_worker_are_replayed_before_describe() {
    let worker = Unimock::new((
        WorkerMock::request.next_call(matching!((request, deadline) if matches!(request.call, Call::CssModules(_)) && *deadline == 30_000)).returns(Ok(MethodResult::Empty)),
        WorkerMock::request.next_call(matching!((request, deadline) if matches!(request.call, Call::Describe(_)) && *deadline == 120_000)).returns(Ok(definitions())),
        WorkerMock::resident_bytes.next_call(matching!()).returns(Ok(0)),
    ));
    let pool = seed(worker, true);
    assert!(matches!(
        pool.request(Call::Describe(Generation {
            generation: "g".into()
        }))
        .unwrap(),
        MethodResult::Definitions(_)
    ));
}

#[test]
fn render_reload_gives_bundle_and_evaluation_their_own_deadlines() {
    let worker = Unimock::new((
        WorkerMock::request.next_call(matching!((request, deadline) if matches!(request.call, Call::Bundle(_)) && *deadline == 120_000)).returns(Ok(MethodResult::Bundle(results::Bundle { generation: "g".into(), modules: Vec::new(), warnings: Vec::new() }))),
        WorkerMock::request.next_call(matching!((request, deadline) if matches!(request.call, Call::CssModules(_)) && *deadline == 30_000)).returns(Ok(MethodResult::Empty)),
        WorkerMock::request.next_call(matching!((request, deadline) if matches!(request.call, Call::Describe(_)) && *deadline == 120_000)).returns(Ok(definitions())),
        WorkerMock::request.next_call(matching!((request, deadline) if matches!(request.call, Call::RenderPage(_)) && *deadline == 30_000)).returns(Ok(MethodResult::Page(Page { html: "document".into(), resources: Vec::new(), warnings: Vec::new() }))),
        WorkerMock::resident_bytes.next_call(matching!()).returns(Ok(0)),
    ));
    let pool = seed(worker, false);
    assert!(matches!(
        pool.request(Call::RenderPage(RenderPage {
            generation: "g".into(),
            handle: "entry.ts#page".into()
        }))
        .unwrap(),
        MethodResult::Page(_)
    ));
}
