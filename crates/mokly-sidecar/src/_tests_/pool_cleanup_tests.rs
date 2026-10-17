//! Loaded generations use the same staleness rule for scheduling and disposal.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::methods::{Bundle, Call};
use crate::pool_state::{Slot, State};
use crate::wire::MethodResult;
use crate::workers::WorkerMock;

fn state(epoch: Option<u64>, bundle: bool) -> State {
    let mut state = State::default();
    if let Some(epoch) = epoch {
        state.epochs.insert("g".into(), epoch);
    }
    if bundle {
        state.bundles.insert(
            "g".into(),
            Bundle {
                source_root: "/repo".into(),
                configuration_directory: String::new(),
                entry_files: vec![],
                renderer: None,
                stories_files: vec![],
                module_resolution: Default::default(),
                repository_roots: vec![],
                evaluation: None,
            },
        );
    }
    state
}

fn slot(worker: Unimock) -> Slot {
    Slot {
        source_root: "/repo".into(),
        worker: Box::new(worker.clone()),
        control: Arc::new(worker),
        generations: BTreeMap::from([("g".into(), 0)]),
        maps: BTreeSet::from(["g".into()]),
        described: BTreeSet::from(["g".into()]),
        bindings: BTreeMap::new(),
        contexts: BTreeSet::new(),
        renders: 0,
        requests: 0,
    }
}

fn stale(epoch: Option<u64>, bundle: bool) {
    let state = state(epoch, bundle);
    let worker = Unimock::new(WorkerMock::request.next_call(matching!((request, _) if matches!(&request.call, Call::Dispose(value) if value.generation == "g"))).returns(Ok(MethodResult::Empty)));
    let mut slot = slot(worker);
    assert!(super::pending(&state, &slot));
    let state = Mutex::new(state);
    super::cleanup(&state, &mut slot, None).unwrap();
    assert!(slot.generations.is_empty());
    assert!(slot.maps.is_empty());
    assert!(slot.described.is_empty());
    assert!(!super::pending(&state.lock().unwrap(), &slot));
}

#[test]
fn a_missing_epoch_disposes_an_epoch_zero_generation() {
    stale(None, true);
}

#[test]
fn a_missing_bundle_with_a_matching_epoch_is_pending() {
    stale(Some(0), false);
}

#[test]
fn a_replaced_epoch_is_pending_and_disposed() {
    stale(Some(1), true);
}

#[test]
fn a_matching_epoch_zero_generation_stays_loaded() {
    let state = state(Some(0), true);
    let mut slot = slot(Unimock::new(()));
    assert!(!super::pending(&state, &slot));
    super::cleanup(&Mutex::new(state), &mut slot, None).unwrap();
    assert_eq!(slot.generations, BTreeMap::from([("g".into(), 0)]));
}
