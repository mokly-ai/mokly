//! Bundle preparation pins stylesheet requests and release to its owning slot.

use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::sync::{Arc, Mutex, OnceLock, Weak};

use unimock::{MockFn, Unimock, matching};

use crate::compiled_fixture::compiled;
use crate::methods::{Bundle, BundleRequest, Call, ProcessCss};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::Slot;
use crate::postcss_preparation::PostcssPreparation;
use crate::results;
use crate::wire::MethodResult;
use crate::workers::{ControlMock, WorkerMock};

fn css(context: &str) -> Call {
    Call::ProcessCss(ProcessCss {
        context: context.into(),
        source_root: "/repo".into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
        postcss: "postcss.mjs".into(),
        source_path: "style.css".into(),
        text: String::new(),
    })
}

fn prepared(context: &str) -> Call {
    Call::Bundle(BundleRequest {
        preparation: Some(PostcssPreparation {
            context: context.into(),
            postcss: "postcss.mjs".into(),
        }),
        params: Bundle {
            evaluation: None,
            entry_files: vec![],
            renderer: None,
            stories_files: vec![],
            storybook_folders: Default::default(),
            source_root: "/repo".into(),
            configuration_directory: ".".into(),
            repository_roots: vec![],
            module_resolution: Default::default(),
            vite: false,
        },
        capture: None,
        plan: None,
    })
}

fn bundled() -> MethodResult {
    MethodResult::Bundle(Box::new(results::Bundle {
        generation: "prepared".into(),
        epoch: 0,
        cache: None,
        compile_count: 1,
        modules: Default::default(),
        unmapped_dependency_directories: None,
        plan: None,
        compiled: Arc::new(compiled("prepared")),
    }))
}

/// A pool with one live idle slot for each worker.
fn pool(workers: &[Unimock]) -> Pool {
    let pool = Pool::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Launch {
            capture_durability: false,
            node: "node".into(),
            entry: "sidecar.js".into(),
            repository: "/repo".into(),
            version: "test".into(),
        },
        PoolOptions {
            size: workers.len().try_into().unwrap(),
            timeout_ms: None,
        },
    );
    {
        let mut state = pool.lock();
        for (index, worker) in workers.iter().enumerate() {
            state.controls.insert(index, Arc::new(worker.clone()));
            state.slots.push(Some(Slot {
                source_root: "/repo".into(),
                worker: Box::new(worker.clone()),
                control: Arc::new(worker.clone()),
                generations: BTreeMap::new(),
                maps: BTreeSet::new(),
                described: BTreeSet::new(),
                bindings: BTreeMap::new(),
                contexts: BTreeSet::new(),
                renders: 0,
                requests: 0,
                last_compilation: None,
            }));
        }
        state.available = (0..workers.len()).collect();
    }
    pool
}

#[test]
fn prepared_context_requests_and_disposal_use_the_bundle_owner() {
    let observed = Arc::new(Mutex::new(Vec::new()));
    let workers: Vec<_> = (0..2)
        .map(|index| {
            let events = observed.clone();
            Unimock::new((
                WorkerMock::request
                    .each_call(matching!(_, _))
                    .answers_arc(Arc::new(move |_, request, _| {
                        let kind = match &request.call {
                            Call::PrepareContext(_) => "prepare",
                            Call::Bundle(_) => "bundle",
                            Call::ProcessCss(_) => "css",
                            Call::DisposeContext(_) => "dispose",
                            _ => panic!("unexpected call"),
                        };
                        events.lock().unwrap().push((index, kind));
                        Ok(if kind == "bundle" {
                            bundled()
                        } else {
                            MethodResult::Empty
                        })
                    }))
                    .at_least_times(0),
                WorkerMock::resident_bytes
                    .each_call(matching!())
                    .answers(&|_| Ok(0))
                    .at_least_times(0),
                ControlMock::kill.some_call(matching!()).returns(Ok(())),
            ))
        })
        .collect();
    let pool = pool(&workers);
    for context in ["warm-0", "warm-1"] {
        pool.request(css(context)).unwrap();
        pool.release_context(context);
    }
    pool.synchronize_releases();
    pool.lock().available = VecDeque::from([0, 1]);
    observed.lock().unwrap().clear();
    pool.request(prepared("attempt")).unwrap();
    pool.request(css("attempt")).unwrap();
    pool.release_context("attempt");
    pool.synchronize_releases();
    pool.abort().unwrap();
    assert_eq!(
        *observed.lock().unwrap(),
        [(0, "prepare"), (0, "bundle"), (0, "css"), (0, "dispose")]
    );
}

#[test]
fn a_release_after_prepare_context_disposes_the_context_after_its_bundle() {
    let owner: Arc<OnceLock<Weak<Pool>>> = Arc::default();
    let observed = Arc::new(Mutex::new(Vec::new()));
    let (releases, events) = (owner.clone(), observed.clone());
    let workers = [Unimock::new((
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                let kind = match &request.call {
                    Call::PrepareContext(_) => "prepare",
                    Call::Bundle(_) => "bundle",
                    Call::DisposeContext(_) => "dispose",
                    _ => panic!("unexpected call"),
                };
                events.lock().unwrap().push(kind);
                if kind == "prepare" {
                    let pool = releases.get().and_then(Weak::upgrade).unwrap();
                    pool.release_context("attempt");
                }
                Ok(if kind == "bundle" {
                    bundled()
                } else {
                    MethodResult::Empty
                })
            })),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0)),
    ))];
    let pool = Arc::new(pool(&workers));
    owner.set(Arc::downgrade(&pool)).unwrap();
    pool.request(prepared("attempt")).unwrap();
    pool.synchronize_releases();
    assert_eq!(*observed.lock().unwrap(), ["prepare", "bundle", "dispose"]);
    let state = pool.lock();
    assert_eq!(state.contexts, BTreeSet::new());
    assert_eq!(state.slots[0].as_ref().unwrap().contexts, BTreeSet::new());
}
