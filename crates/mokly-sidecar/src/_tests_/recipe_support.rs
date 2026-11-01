//! Counted worker requests exercise recipe retention through the pool boundary.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::codec;
use crate::compiled::{CompiledGeneration, RestoreGeneration};
use crate::methods::{Bundle, Call};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::Slot;
use crate::results;
use crate::wire::{MethodResult, Request};
use crate::workers::{ClockMock, WorkerMock};

use super::{Recipes, seed_id};

pub(super) fn settings(entry: &str, evaluation: &str) -> Bundle {
    Bundle {
        evaluation: Some(evaluation.into()),
        entry_files: vec![entry.into()],
        stories_files: Vec::new(),
        renderer: None,
        source_root: "/repo".into(),
        configuration_directory: ".".into(),
        repository_roots: Vec::new(),
        module_resolution: Default::default(),
    }
}

fn compiled(id: &str) -> CompiledGeneration {
    CompiledGeneration {
        identity: id.into(),
        code: "quoted \"code\" with a newline\n and Unicode \u{e9}".repeat(4),
        runtime_key: "runtime".into(),
        dependency_roots: Vec::new(),
        css_modules: Vec::new(),
        sources: BTreeMap::new(),
        peers: BTreeMap::new(),
        inputs: BTreeMap::new(),
        metadata_inputs: BTreeMap::new(),
        input_directories: BTreeMap::new(),
        metadata_directories: BTreeMap::new(),
        unmapped_dependency_directories: None,
    }
}

pub(super) fn envelope_size(entry: &str, id: &str) -> usize {
    codec::encode(&Request {
        id: 1,
        call: Call::RestoreGeneration(Box::new(RestoreGeneration {
            generation: seed_id(id),
            params: settings(entry, id),
            modules: Vec::new(),
            compiled: compiled(id),
        })),
    })
    .unwrap()
    .len()
        - 1
}

pub(super) struct Fixture {
    pub(super) pool: Pool,
    pub(super) calls: Arc<Mutex<Vec<Call>>>,
    _worker: Unimock,
}

impl Fixture {
    pub(super) fn new(bound: usize) -> Self {
        let calls = Arc::new(Mutex::new(Vec::new()));
        let recorded = calls.clone();
        let worker = Unimock::new((
            WorkerMock::request
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, request, _| {
                    recorded.lock().unwrap().push(request.call.clone());
                    Ok(match &request.call {
                        Call::Bundle(params) => {
                            let id = params.evaluation.as_deref().unwrap();
                            MethodResult::Bundle(results::Bundle {
                                generation: id.into(),
                                compiled: (!id.starts_with("probe")).then(|| compiled(id)),
                                epoch: 0,
                                modules: Vec::new(),
                                warnings: Vec::new(),
                                unmapped_dependency_directories: None,
                            })
                        }
                        _ => MethodResult::Empty,
                    })
                })),
            WorkerMock::resident_bytes
                .each_call(matching!())
                .answers(&|_| Ok(0)),
        ));
        let pool = Pool::new(
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(
                ClockMock::now_ms.each_call(matching!()).returns(0_u64),
            )),
            Launch {
                node: "node".into(),
                entry: "sidecar.js".into(),
                repository: "/repo".into(),
                version: "test".into(),
            },
            PoolOptions {
                size: 4.try_into().unwrap(),
                timeout_ms: None,
            },
        );
        {
            let mut state = pool.lock().unwrap();
            state.recipes = Recipes::new(bound);
            for index in 0..4 {
                state.slots.push(Some(Slot {
                    source_root: "/repo".into(),
                    worker: Box::new(worker.clone()),
                    control: Arc::new(worker.clone()),
                    generations: BTreeMap::new(),
                    maps: Default::default(),
                    described: Default::default(),
                    bindings: BTreeMap::new(),
                    contexts: Default::default(),
                    renders: 0,
                    requests: 1,
                }));
                state.available.push_back(index);
            }
        }
        Self {
            pool,
            calls,
            _worker: worker,
        }
    }

    pub(super) fn retained(&self) -> usize {
        self.pool.lock().unwrap().recipes.len()
    }

    pub(super) fn select(&self, slot: usize) {
        let mut state = self.pool.lock().unwrap();
        state.available.retain(|index| *index != slot);
        state.available.push_front(slot);
    }

    pub(super) fn bundle(&self, entry: &str, id: &str) -> results::Bundle {
        let MethodResult::Bundle(result) = self
            .pool
            .request(Call::Bundle(settings(entry, id)))
            .unwrap()
        else {
            panic!("expected bundle")
        };
        result
    }

    pub(super) fn release(&self, entry: &str, id: &str) {
        let result = self.bundle(entry, id);
        self.pool
            .release_generation(&result.generation, result.epoch);
        self.pool.synchronize_releases();
    }

    pub(super) fn probe(&self, entry: &str, id: &str, slot: usize) -> Vec<String> {
        self.select(slot);
        self.calls.lock().unwrap().clear();
        self.bundle(entry, id);
        self.calls
            .lock()
            .unwrap()
            .iter()
            .filter_map(|call| match call {
                Call::RestoreGeneration(recipe) => Some(recipe.compiled.identity.clone()),
                _ => None,
            })
            .collect()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        self.pool.synchronize_releases();
        self.pool.shutdown().unwrap();
    }
}
