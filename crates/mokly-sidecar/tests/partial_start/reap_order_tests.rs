//! A stopped sidecar stays unreaped until the last signal of its tree.

use std::sync::Arc;

use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::workers::{Clock, Diagnostics, WorkerFactory};
use mokly_test_support::reap_order::{Root, Watched};

use crate::partial_start::fixture::Tree;

struct Quiet;
impl Diagnostics for Quiet {
    fn emit(&self, _: &str) {}
}

#[test]
fn a_stopped_sidecar_is_reaped_only_after_its_last_tree_signal() {
    let tree = Tree::new();
    let groups = Arc::new(Watched::default());
    let clock = Arc::new(SystemClock::default());
    let factory = NodeFactory::new(
        groups.clone(),
        clock.clone(),
        Arc::new(Quiet),
        Arc::new(SystemMemory),
    );
    let spawned = match factory.spawn(&tree.launch()) {
        Ok(spawned) => spawned,
        Err(failure) => panic!("spawn failed: {failure:?}"),
    };
    tree.ready(groups.roots()[0]);
    let control = Arc::clone(&spawned.control);
    control.kill().unwrap();
    control.finish(clock.now_ms() + 10_000).unwrap();
    drop(spawned);
    drop(control);
    tree.assert_stopped();
    let states = groups.states();
    assert!(!states.is_empty(), "no tree signal");
    assert!(
        !states.contains(&Root::Reaped),
        "a tree signal followed the reap: {states:?}"
    );
}
