//! Context release visits every idle slot which retains a worker for that context.

use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::methods::Call;
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::{Affinity, Slot};
use crate::wire::MethodResult;
use crate::workers::{ClockMock, WorkerMock};

#[test]
fn release_disposes_all_serving_slots_and_never_starts_a_worker_after_shutdown() {
    let workers: Vec<_> = (0..2).map(|_| Unimock::new(WorkerMock::request.next_call(matching!((request, _) if matches!(&request.call, Call::DisposeContext(params) if params.context == "used"))).returns(Ok(MethodResult::Empty)))).collect();
    let clock = Unimock::new(ClockMock::now_ms.next_call(matching!()).returns(0_u64));
    let pool = Pool::new(
        Arc::new(Unimock::new(())),
        Arc::new(clock.clone()),
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
        state.slots = workers
            .iter()
            .map(|worker| {
                Some(Slot {
                    source_root: "/repo".into(),
                    worker: Box::new(worker.clone()),
                    control: Arc::new(worker.clone()),
                    generations: BTreeMap::new(),
                    maps: BTreeSet::new(),
                    described: BTreeSet::new(),
                    bindings: BTreeMap::new(),
                    contexts: BTreeSet::from(["used".into()]),
                    renders: 0,
                    requests: 0,
                })
            })
            .collect();
        state.available = VecDeque::from([0, 1]);
        state.contexts.insert("used".into());
        state.affinity.insert(
            "used".into(),
            Affinity {
                index: 0,
                source_root: "/repo".into(),
            },
        );
    }
    pool.release_context("used");
    pool.synchronize_releases();
    assert!(
        pool.lock()
            .unwrap()
            .slots
            .iter()
            .all(|slot| slot.as_ref().unwrap().contexts.is_empty())
    );
    pool.shutdown().unwrap();
    pool.release_context("used");
    pool.synchronize_releases();
    assert!(pool.lock().unwrap().contexts.is_empty());
}
