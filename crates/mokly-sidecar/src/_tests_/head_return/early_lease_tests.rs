//! Early work excludes the warm head, reaps replacements, and restores its own recipe.

use std::sync::Arc;
use std::thread;

use crate::bindings::Bindings;
use crate::early_lease::{EarlyCall, EarlyLease};
use crate::methods::{Call, CssModules, Generation};
use crate::pool::SidecarPool;

use super::process::Mode;
use super::support::{Event, Gate, Harness, bundle, css, render};

fn completed(lease: &dyn EarlyLease, call: Call) {
    let result = lease.request(call);
    assert!(matches!(result, EarlyCall::Complete(Ok(_))));
}

#[test]
fn early_work_preserves_the_warm_head_and_restores_its_generation_after_both_reaps() {
    let busy = Arc::new(Gate::default());
    let held = busy.clone();
    let harness = Harness::new(
        2,
        &[Mode::Foreground, Mode::Base, Mode::Base, Mode::Foreground],
        Arc::new(move |event| {
            if event == Event::Request(1, "busy".into()) {
                held.block();
            }
        }),
    );
    harness.pool.request(bundle("/head", "head")).unwrap();
    let pool = harness.pool.clone();
    let request = thread::spawn(move || pool.request(css("/other", "busy")));
    busy.entered();
    let blocked = harness.pool.try_early(&bundle("/base", "base")).unwrap();
    let protected = blocked.is_none();
    busy.open();
    request.join().unwrap().unwrap();
    if let Some(blocked) = blocked {
        blocked.finish().unwrap();
    }
    assert!(protected);
    let lease = harness
        .pool
        .try_early(&bundle("/base", "base"))
        .unwrap()
        .unwrap();
    completed(lease.as_ref(), bundle("/base", "base"));
    completed(
        lease.as_ref(),
        Call::CssModules(CssModules {
            generation: "base".into(),
            class_maps: Default::default(),
        }),
    );
    completed(
        lease.as_ref(),
        Call::Describe(Generation {
            generation: "base".into(),
        }),
    );
    completed(
        lease.as_ref(),
        Call::Bindings(Bindings {
            generation: "base".into(),
            entries: Default::default(),
        }),
    );
    harness.pool.request(bundle("/head", "head")).unwrap();
    lease.finish().unwrap();
    harness.pool.request(render("base")).unwrap();
    let slots = harness.pool.lock().slots.len();
    let events = harness.events.read();
    harness.pool.abort().unwrap();
    let first_reap = events
        .iter()
        .position(|event| *event == Event::Reap(1))
        .unwrap();
    let base_start = events
        .iter()
        .position(|event| *event == Event::Spawn(2, "/base".into()))
        .unwrap();
    let final_reap = events
        .iter()
        .position(|event| *event == Event::Reap(2))
        .unwrap();
    let capture_start = events
        .iter()
        .position(|event| *event == Event::Spawn(3, "/base".into()))
        .unwrap();
    assert_eq!(slots, 2);
    assert!(first_reap < base_start);
    assert!(final_reap < capture_start);
    assert!(!events.contains(&Event::Kill(0)));
    assert!(events.contains(&Event::Request(3, "restoreGeneration base".into())));
    assert_eq!(
        events.last(),
        Some(&Event::Request(3, "page export default".into()))
    );
}
