//! Two process slots must replay the current maps and binding tables.

use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::bindings::{Bindings, EntryBinding};
use crate::definitions::Definitions;
use crate::methods::{Bundle, Call, CssModules, Generation, ModuleResolution, RenderPage};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::Slot;
use crate::results;
use crate::wire::MethodResult;
use crate::workers::WorkerMock;

fn label(call: &Call) -> String {
    match call {
        Call::Dispose(_) => "dispose".into(),
        Call::Bundle(_) => "bundle".into(),
        Call::Describe(_) => "describe".into(),
        Call::CssModules(value) => format!("maps:{}", value.class_maps["card.module.css"]["card"]),
        Call::Bindings(value) => format!("bindings:{}", value.entries["entry#default"].path),
        Call::RenderPage(_) => "render".into(),
        _ => panic!("unexpected request"),
    }
}

fn worker(expected: &[&str], calls: usize) -> Unimock {
    let order = Mutex::new(
        expected
            .iter()
            .map(|s| s.to_string())
            .collect::<VecDeque<_>>(),
    );
    let count = expected.len();
    Unimock::new((
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                assert_eq!(
                    order.lock().unwrap().pop_front().unwrap(),
                    label(&request.call)
                );
                Ok(match &request.call {
                    Call::Bundle(_) => MethodResult::Bundle(results::Bundle {
                        generation: "g".into(),
                        modules: Vec::new(),
                        warnings: Vec::new(),
                    }),
                    Call::Describe(_) => MethodResult::Definitions(Definitions {
                        screens: Vec::new(),
                        pages: Vec::new(),
                        use_cases: Vec::new(),
                        folders: Vec::new(),
                        components: Vec::new(),
                        stories: Vec::new(),
                        diagnostics: Vec::new(),
                        warnings: Vec::new(),
                    }),
                    Call::RenderPage(_) => MethodResult::Page(results::Page {
                        html: "new-control".into(),
                        resources: Vec::new(),
                        warnings: Vec::new(),
                    }),
                    _ => MethodResult::Empty,
                })
            }))
            .n_times(count),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0))
            .n_times(calls),
    ))
}

fn bundle() -> Bundle {
    Bundle {
        entry_files: vec!["entry".into()],
        renderer: None,
        stories_files: Vec::new(),
        module_resolution: ModuleResolution::default(),
        source_root: "/repo".into(),
        configuration_directory: ".".into(),
        repository_roots: Vec::new(),
    }
}

fn maps(value: &str) -> CssModules {
    CssModules {
        generation: "g".into(),
        class_maps: BTreeMap::from([(
            "card.module.css".into(),
            BTreeMap::from([("card".into(), value.into())]),
        )]),
    }
}

fn bindings(value: &str) -> Bindings {
    Bindings {
        generation: "g".into(),
        entries: BTreeMap::from([(
            "entry#default".into(),
            EntryBinding {
                path: value.into(),
                title: value.into(),
            },
        )]),
    }
}

fn pair(first: Unimock, second: Unimock) -> Pool {
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
            size: 2.try_into().unwrap(),
            timeout_ms: None,
        },
    );
    {
        let mut state = pool.lock().unwrap();
        for mock in [first, second] {
            state.slots.push(Some(Slot {
                worker: Box::new(mock.clone()),
                control: Arc::new(mock),
                generations: BTreeMap::from([("g".into(), 0)]),
                maps: BTreeSet::from(["g".into()]),
                described: BTreeSet::from(["g".into()]),
                bindings: BTreeMap::from([("g".into(), bindings("old/card"))]),
                contexts: BTreeSet::new(),
                renders: 0,
            }));
        }
        state.available.push_back(0);
        state.bundles.insert("g".into(), bundle());
        state.maps.insert("g".into(), maps("old-control"));
        state.bindings.insert("g".into(), bindings("old/card"));
    }
    pool
}

fn render(pool: &Pool) {
    assert!(matches!(
        pool.request(Call::RenderPage(RenderPage {
            generation: "g".into(),
            handle: "entry#default".into()
        }))
        .unwrap(),
        MethodResult::Page(_)
    ));
}

#[test]
fn a_busy_second_process_reloads_maps_after_dispose_and_rebundle() {
    let sequence = [
        "dispose",
        "bundle",
        "maps:new-control",
        "describe",
        "bindings:new/card",
        "render",
    ];
    let pool = pair(worker(&sequence, 6), worker(&sequence, 1));
    pool.request(Call::Dispose(Generation {
        generation: "g".into(),
    }))
    .unwrap();
    pool.request(Call::Bundle(bundle())).unwrap();
    pool.request(Call::CssModules(maps("new-control"))).unwrap();
    pool.request(Call::Describe(Generation {
        generation: "g".into(),
    }))
    .unwrap();
    pool.request(Call::Bindings(bindings("new/card"))).unwrap();
    pool.lock().unwrap().available.push_front(1);
    render(&pool);
    render(&pool);
}

#[test]
fn an_updated_binding_table_is_replayed_on_the_second_process() {
    let pool = pair(
        worker(&["bindings:new/card"], 1),
        worker(&["bindings:new/card", "render"], 1),
    );
    pool.request(Call::Bindings(bindings("new/card"))).unwrap();
    pool.lock().unwrap().available.push_front(1);
    render(&pool);
}
