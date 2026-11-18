//! Pool cache tests use real pool entry points with mocked workers and stores.

mod order_tests;
mod plan_tests;
mod recovery_tests;
mod restore_tests;
mod write_tests;

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::bundle_store::{BundleStoreMock, ReadOutcome, RecordToken, WriteOutcome};
use crate::compiled::CompiledGeneration;
use crate::compiled_fixture::compiled;
use crate::durable_recipe::DurableRecipe;
use crate::methods::{Bundle, BundleRequest, Call};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::Slot;
use crate::results;
use crate::reusable_recipe::ReusableRecipe;
use crate::wire::MethodResult;
use crate::workers::WorkerMock;

type Events = Arc<Mutex<Vec<String>>>;

fn params() -> Bundle {
    Bundle {
        evaluation: None,
        entry_files: vec!["entry.ts".into()],
        renderer: None,
        stories_files: vec![],
        source_root: "/repo".into(),
        configuration_directory: ".".into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
    }
}

fn compilation(id: &str, complete: bool) -> CompiledGeneration {
    let mut value = compiled(id);
    value.runtime_key = format!("runtime:{id}");
    Arc::make_mut(&mut value.reuse_evidence).complete = complete;
    value
}

fn answer(id: &str) -> MethodResult {
    MethodResult::Bundle(Box::new(results::Bundle {
        plan: None,
        generation: id.into(),
        compiled: Arc::new(compilation(id, true)),
        cache: None,
        epoch: 0,
        modules: vec![],
        unmapped_dependency_directories: None,
    }))
}

fn recipe(id: &str) -> DurableRecipe {
    DurableRecipe::new(
        ReusableRecipe::new(id.into(), params(), vec![], Arc::new(compilation(id, true))).unwrap(),
    )
    .unwrap()
}

fn hit(id: &str) -> ReadOutcome {
    ReadOutcome::Hit {
        recipe: Box::new(recipe(id)),
        token: RecordToken::new([7; 32]),
        maintenance: WriteOutcome::Unchanged,
    }
}

fn worker(events: Events, result: &str) -> Unimock {
    let result = result.to_owned();
    Unimock::new((
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                let event = match &request.call {
                    Call::RestoreGeneration(value) => format!("restore:{}", value.generation),
                    Call::Dispose(value) => format!("dispose:{}", value.generation),
                    Call::Bundle(_) => "bundle".into(),
                    Call::CssModules(_) => "maps".into(),
                    _ => "other".into(),
                };
                events.lock().unwrap().push(event);
                Ok(if matches!(request.call, Call::Bundle(_)) {
                    answer(&result)
                } else {
                    MethodResult::Empty
                })
            })),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0)),
    ))
}

fn pool(store: Unimock, worker: Unimock) -> Arc<Pool> {
    let pool = Arc::new(
        Pool::new(
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
                size: 2.try_into().unwrap(),
                timeout_ms: None,
            },
        )
        .with_bundle_store(Arc::new(store)),
    );
    {
        let mut state = pool.lock();
        for control in [worker.clone(), worker] {
            state.slots.push(Some(Slot {
                source_root: "/repo".into(),
                worker: Box::new(control.clone()),
                control: Arc::new(control),
                generations: BTreeMap::new(),
                maps: Default::default(),
                described: Default::default(),
                bindings: BTreeMap::new(),
                contexts: Default::default(),
                renders: 0,
                requests: 1,
            }));
        }
        state.available.extend([0, 1]);
    }
    pool
}

fn live(pool: &Pool, id: &str, epoch: u64, complete: bool, installed: bool) {
    let mut state = pool.lock();
    state.bundles.insert(id.into(), params());
    state
        .compiled
        .insert(id.into(), Arc::new(compilation(id, complete)));
    state.modules.insert(id.into(), vec![]);
    state.epochs.insert(id.into(), epoch);
    state.next_epoch = state.next_epoch.max(epoch);
    state.leases.insert(id.into(), [epoch].into());
    if installed {
        state.slots[0]
            .as_mut()
            .unwrap()
            .generations
            .insert(id.into(), epoch);
    }
}

fn bundle(pool: &Pool) -> results::Bundle {
    let MethodResult::Bundle(result) = pool
        .request(Call::Bundle(BundleRequest {
            plan: None,
            params: params(),
            capture: None,
        }))
        .unwrap()
    else {
        panic!("expected bundle")
    };
    *result
}

fn unchanged_hit() -> Unimock {
    Unimock::new((
        BundleStoreMock::load
            .some_call(matching!(_))
            .returns(hit("seed")),
        BundleStoreMock::save
            .each_call(matching!(_))
            .returns(WriteOutcome::Unchanged),
    ))
}
