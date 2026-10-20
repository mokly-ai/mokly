//! Replay snapshots materialize only prerequisites missing from the worker.

use std::collections::BTreeMap;
use std::sync::Arc;

use unimock::Unimock;

use crate::bindings::{Bindings, EntryBinding};
use crate::compiled::CompiledGeneration;
use crate::methods::{Bundle, CssModules, ModuleResolution};
use crate::pool_state::{Slot, State};
use crate::results::Module;

use super::Preparation;

fn fixture() -> (State, Slot) {
    let mut state = State::default();
    state.epochs.insert("g".into(), 7);
    state.bundles.insert(
        "g".into(),
        Bundle {
            evaluation: Some("evaluation".into()),
            entry_files: vec!["entry.ts".into()],
            renderer: None,
            stories_files: Vec::new(),
            module_resolution: ModuleResolution::default(),
            source_root: "/repo".into(),
            configuration_directory: ".".into(),
            repository_roots: Vec::new(),
        },
    );
    state.modules.insert(
        "g".into(),
        vec![Module {
            digest: Some("digest".into()),
            path: "entry.ts".into(),
            imports: vec!["shared.ts".into()],
        }],
    );
    state.compiled.insert(
        "g".into(),
        Arc::new(CompiledGeneration {
            unmapped_dependency_directories: None,
            identity: "compiled".into(),
            code: "code".into(),
            runtime_key: "runtime".into(),
            dependency_roots: Vec::new(),
            css_modules: vec!["entry.module.css".into()],
            sources: BTreeMap::from([("entry.ts".into(), "source".into())]),
            peers: BTreeMap::new(),
            inputs: BTreeMap::new(),
            metadata_inputs: BTreeMap::new(),
            input_directories: BTreeMap::new(),
            metadata_directories: BTreeMap::new(),
        }),
    );
    state.maps.insert(
        "g".into(),
        CssModules {
            generation: "g".into(),
            class_maps: BTreeMap::from([(
                "entry.module.css".into(),
                BTreeMap::from([("class".into(), "scoped".into())]),
            )]),
        },
    );
    state.bindings.insert(
        "g".into(),
        Arc::new(Bindings {
            generation: "g".into(),
            entries: BTreeMap::from([(
                "entry.ts#default".into(),
                EntryBinding {
                    path: "entry".into(),
                    title: "Entry".into(),
                },
            )]),
        }),
    );
    let slot = Slot {
        source_root: "/repo".into(),
        worker: Box::new(Unimock::new(())),
        control: Arc::new(Unimock::new(())),
        generations: BTreeMap::new(),
        maps: Default::default(),
        described: Default::default(),
        bindings: BTreeMap::new(),
        contexts: Default::default(),
        renders: 0,
        requests: 0,
    };
    (state, slot)
}

#[test]
fn fresh_worker_retains_complete_replay_inputs() {
    let (state, slot) = fixture();
    let replay = Preparation::snapshot(&state, &slot, "g", true, true, true);
    assert_eq!(replay.epoch, 7);
    assert_eq!(replay.bundle.unwrap().entry_files, ["entry.ts"]);
    assert_eq!(replay.modules[0].imports, ["shared.ts"]);
    assert_eq!(replay.compiled.unwrap().code, "code");
    assert_eq!(
        replay.maps.unwrap().class_maps["entry.module.css"]["class"],
        "scoped"
    );
    assert_eq!(
        replay.bindings.unwrap().entries["entry.ts#default"].path,
        "entry"
    );
}

#[test]
fn prepared_worker_does_not_materialize_catalogue_replay_inputs() {
    let (state, mut slot) = fixture();
    slot.generations.insert("g".into(), 7);
    slot.maps.insert("g".into());
    slot.described.insert("g".into());
    slot.bindings = state.bindings.clone();
    for _ in 0..4 {
        let replay = Preparation::snapshot(&state, &slot, "g", true, true, true);
        assert!(replay.bundle.is_none());
        assert!(replay.modules.is_empty());
        assert!(replay.compiled.is_none());
        assert!(replay.maps.is_none());
        assert!(replay.bindings.is_none());
    }
}

#[test]
fn replay_omits_prerequisites_that_the_request_does_not_need() {
    let (state, slot) = fixture();
    let replay = Preparation::snapshot(&state, &slot, "g", false, false, false);
    assert!(replay.bundle.is_some());
    assert_eq!(replay.modules.len(), 1);
    assert!(replay.compiled.is_some());
    assert!(replay.maps.is_none());
    assert!(replay.bindings.is_none());
}

#[test]
fn new_binding_revision_replays_without_copying_other_inputs() {
    let (mut state, mut slot) = fixture();
    slot.generations.insert("g".into(), 7);
    slot.maps.insert("g".into());
    slot.described.insert("g".into());
    slot.bindings = state.bindings.clone();
    let mut changed = (*state.bindings["g"]).clone();
    changed.entries.get_mut("entry.ts#default").unwrap().title = "Updated".into();
    state.bindings.insert("g".into(), Arc::new(changed));
    let replay = Preparation::snapshot(&state, &slot, "g", true, true, true);
    let bindings = replay.bindings.unwrap();
    assert!(Arc::ptr_eq(&bindings, &state.bindings["g"]));
    assert_eq!(bindings.entries["entry.ts#default"].title, "Updated");
    assert!(replay.bundle.is_none());
    assert!(replay.modules.is_empty());
    assert!(replay.maps.is_none());
}
