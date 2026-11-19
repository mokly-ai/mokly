//! Complete retained generations and mocked slots for acquisition boundaries.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use unimock::Unimock;

use crate::bindings::Bindings;
use crate::compiled_fixture::compiled;
use crate::methods::{Bundle, Call, CssModules, Generation, RenderPage};
use crate::pool::Pool;
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::{Slot, State};

#[derive(Clone, Copy, Debug)]
pub(super) enum Loaded {
    None,
    Generation,
    Maps,
    Described,
    Ready,
    OldBindings,
    OldEpoch,
}

pub(super) fn bundle(root: &str) -> Bundle {
    Bundle {
        evaluation: None,
        entry_files: vec!["page.ts".into()],
        renderer: None,
        stories_files: vec![],
        module_resolution: Default::default(),
        source_root: root.into(),
        configuration_directory: ".".into(),
        repository_roots: vec![],
    }
}

pub(super) fn maps() -> CssModules {
    CssModules {
        generation: "g".into(),
        class_maps: BTreeMap::new(),
    }
}

pub(super) fn bindings() -> Bindings {
    Bindings {
        generation: "g".into(),
        entries: BTreeMap::new(),
    }
}

pub(super) fn describe() -> Call {
    Call::Describe(Generation {
        generation: "g".into(),
    })
}

pub(super) fn render() -> Call {
    Call::RenderPage(RenderPage {
        generation: "g".into(),
        handle: "page.ts#default".into(),
    })
}

pub(super) fn pool(slots: &[(&str, Loaded)]) -> Pool {
    let pool = Pool::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Launch {
            capture_durability: false,
            repository: "/head".into(),
            node: "node".into(),
            entry: "sidecar.js".into(),
            version: "test".into(),
        },
        PoolOptions {
            size: slots.len().try_into().unwrap(),
            timeout_ms: None,
        },
    );
    {
        let mut state = pool.lock();
        state.epochs.insert("g".into(), 7);
        state.bundles.insert("g".into(), bundle("/head"));
        state.compiled.insert("g".into(), Arc::new(compiled("g")));
        state.modules.insert("g".into(), vec![]);
        state.maps.insert("g".into(), maps());
        state.bindings.insert("g".into(), Arc::new(bindings()));
        for (index, (root, loaded)) in slots.iter().enumerate() {
            let slot = slot(&state, root, *loaded);
            state.source_roots.insert(index, (*root).into());
            state.slots.push(Some(slot));
            state.available.push_back(index);
        }
    }
    pool
}

fn slot(state: &State, root: &str, loaded: Loaded) -> Slot {
    let mut slot = Slot {
        source_root: root.into(),
        worker: Box::new(Unimock::new(())),
        control: Arc::new(Unimock::new(())),
        generations: BTreeMap::new(),
        maps: BTreeSet::new(),
        described: BTreeSet::new(),
        bindings: BTreeMap::new(),
        contexts: BTreeSet::new(),
        renders: 0,
        requests: 0,
    };
    if !matches!(loaded, Loaded::None) {
        slot.generations.insert(
            "g".into(),
            if matches!(loaded, Loaded::OldEpoch) {
                6
            } else {
                7
            },
        );
    }
    if !matches!(loaded, Loaded::None | Loaded::Generation) {
        slot.maps.insert("g".into());
    }
    if matches!(
        loaded,
        Loaded::Described | Loaded::Ready | Loaded::OldBindings | Loaded::OldEpoch
    ) {
        slot.described.insert("g".into());
    }
    if matches!(loaded, Loaded::Ready | Loaded::OldEpoch) {
        slot.bindings = state.bindings.clone();
    }
    if matches!(loaded, Loaded::OldBindings) {
        slot.bindings.insert("g".into(), Arc::new(bindings()));
    }
    slot
}

pub(super) fn acquire(pool: &Pool, call: &Call, root: &str) -> usize {
    pool.acquire(call, Some(root.as_ref()), None).unwrap().0
}
