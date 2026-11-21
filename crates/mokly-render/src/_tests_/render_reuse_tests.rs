//! Serve runtime copies reuse live head keys and release every preceding graph.

use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_sidecar::methods::BundleCapture;

#[path = "render_reuse_support.rs"]
mod support;

use support::{Lease, prepare, runtime};

#[test]
fn serve_startup_rechecks_are_full_and_attempt_copies_reuse_only_live_edit_keys() {
    let (runtime, jobs) = runtime();
    let mut runtime = runtime.with_serve_edit_plans();
    let expired = {
        let _first = prepare(&runtime.with_tree(runtime.tree.clone()), "one", None);
        assert_eq!(jobs.swap(0, Ordering::Relaxed), 2, "startup seeds all keys");
        let _rechecked = prepare(&runtime.with_tree(runtime.tree.clone()), "one", None);
        assert_eq!(
            jobs.swap(0, Ordering::Relaxed),
            2,
            "the startup recheck stays full"
        );
        runtime.bundle_capture = BundleCapture::ServeEdit;
        let _edited = prepare(&runtime.with_tree(runtime.tree.clone()), "two", None);
        assert_eq!(
            jobs.swap(0, Ordering::Relaxed),
            1,
            "the edit recomputes only A"
        );
        let unchanged = prepare(&runtime.with_tree(runtime.tree.clone()), "two", None);
        assert_eq!(
            jobs.swap(0, Ordering::Relaxed),
            0,
            "clones share the latest keys"
        );
        Arc::downgrade(&unchanged)
    };
    assert!(expired.upgrade().is_none(), "the runtime holds no graph");
    let _rebuilt = prepare(&runtime, "two", None);
    assert_eq!(
        jobs.swap(0, Ordering::Relaxed),
        2,
        "an expired predecessor forces a full build"
    );
}

#[test]
fn retained_current_keys_pin_no_previous_graph_catalogue_or_generation_lease() {
    let (runtime, jobs) = runtime();
    let mut runtime = runtime.with_serve_edit_plans();
    let (_current, graph, lease) = {
        let lease = Arc::new(Lease);
        let weak_lease = Arc::downgrade(&lease);
        let previous = prepare(&runtime, "one", Some(lease));
        assert_eq!(jobs.swap(0, Ordering::Relaxed), 2);
        runtime.bundle_capture = BundleCapture::ServeEdit;
        let current = prepare(&runtime, "two", None);
        assert_eq!(jobs.swap(0, Ordering::Relaxed), 1);
        (current, Arc::downgrade(&previous), weak_lease)
    };
    assert!(graph.upgrade().is_none());
    assert!(lease.upgrade().is_none());
    let _unchanged = prepare(&runtime, "two", None);
    assert_eq!(
        jobs.swap(0, Ordering::Relaxed),
        0,
        "the retained current graph owns its keys"
    );
}

#[test]
fn base_and_non_serve_preparations_never_reuse_head_keys() {
    let (mut ordinary, jobs) = runtime();
    let mut runtime = ordinary.clone().with_serve_edit_plans();
    let _head = prepare(&runtime, "one", None);
    assert_eq!(jobs.swap(0, Ordering::Relaxed), 2);
    runtime.bundle_capture = BundleCapture::ServeEdit;
    let mut base = runtime.for_base(runtime.tree.clone(), "test".into(), None);
    base.bundle_capture = BundleCapture::ServeEdit;
    assert!(ordinary.render_keys.is_none());
    assert!(base.clone().with_serve_edit_plans().render_keys.is_none());
    let _first_base = prepare(&base, "base", None);
    assert_eq!(
        jobs.swap(0, Ordering::Relaxed),
        2,
        "base cannot use head keys"
    );
    let _second_base = prepare(&base, "base", None);
    assert_eq!(
        jobs.swap(0, Ordering::Relaxed),
        2,
        "base does not seed facts"
    );
    ordinary.bundle_capture = BundleCapture::ServeEdit;
    let _regular_one = prepare(&ordinary, "one", None);
    assert_eq!(jobs.swap(0, Ordering::Relaxed), 2);
    let _regular_two = prepare(&ordinary, "one", None);
    assert_eq!(
        jobs.swap(0, Ordering::Relaxed),
        2,
        "static runtimes stay full"
    );
    let _next_head = prepare(&runtime, "one", None);
    assert_eq!(
        jobs.swap(0, Ordering::Relaxed),
        0,
        "base does not replace head predecessor"
    );
}
