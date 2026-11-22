//! Captured plan lifetime, strict admission, and whole-record physical validation.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_sidecar::methods::{Bundle, BundleCapture};
use unimock::{MockFn, Unimock, matching};

use crate::bundle_attempt::request;
use crate::physical_inputs::PhysicalInputsMock;

use super::bundle_plan_support::{evidence, params, plan, result, runtime};

#[test]
fn a_captured_record_shares_evidence_and_survives_lease_release_stale_checks_and_edits() {
    let current = Arc::new(AtomicBool::new(true));
    let reads = current.clone();
    let physical = Unimock::new(
        PhysicalInputsMock::matches
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new(
                move |_, _, _, _| Ok(reads.load(Ordering::Acquire)),
            )),
    );
    let calls = Arc::new(Mutex::new(vec![]));
    let evidence = evidence();
    let plan = plan();
    let mut runtime = runtime(
        physical,
        vec![result(Some(plan.clone()), evidence.clone())],
        calls.clone(),
    )
    .with_serve_edit_plans();
    let (first, lease) = request(&runtime, &params(), None).unwrap();
    drop((first, lease));
    assert_eq!(
        Arc::strong_count(&evidence),
        2,
        "the core must share the exact evidence Arc"
    );
    runtime.bundle_capture = BundleCapture::ServeEdit;
    for expected in [true, false, true] {
        current.store(expected, Ordering::Release);
        let (_, lease) = request(&runtime, &params(), None).unwrap();
        assert_eq!(
            calls.lock().unwrap().last().unwrap().plan,
            expected.then(|| plan.clone())
        );
        drop(lease);
    }
    assert_eq!(
        Arc::strong_count(&evidence),
        2,
        "edits must keep the captured record unchanged"
    );
    let mut evaluation = params();
    evaluation.evaluation = Some("new evaluation".into());
    let _ = request(&runtime, &evaluation, None).unwrap();
    assert_eq!(calls.lock().unwrap().last().unwrap().plan, Some(plan));
}

#[test]
fn plan_records_match_resolution_settings_and_require_current_evidence() {
    let current = Arc::new(AtomicBool::new(true));
    let reads = current.clone();
    let calls = Arc::new(Mutex::new(vec![]));
    let mut runtime = runtime(
        Unimock::new(
            PhysicalInputsMock::matches
                .each_call(matching!(_, _, _))
                .answers_arc(Arc::new(
                    move |_, _, _, _| Ok(reads.load(Ordering::Acquire)),
                )),
        ),
        vec![result(Some(plan()), evidence())],
        calls.clone(),
    )
    .with_serve_edit_plans();
    let _ = request(&runtime, &params(), None).unwrap();
    runtime.bundle_capture = BundleCapture::ServeEdit;
    let original = params();
    let mut resolution = original.module_resolution.clone();
    resolution.aliases.insert("old".into(), "new".into());
    for (name, params, reusable) in [
        (
            "source root",
            Bundle {
                source_root: "/other".into(),
                ..original.clone()
            },
            false,
        ),
        (
            "entries",
            Bundle {
                entry_files: vec!["entry.ts".into(), "other.ts".into()],
                ..original.clone()
            },
            true,
        ),
        (
            "stories",
            Bundle {
                stories_files: vec!["story.ts".into()],
                ..original.clone()
            },
            true,
        ),
        (
            "renderer",
            Bundle {
                renderer: Some("renderer.tsx".into()),
                ..original.clone()
            },
            true,
        ),
        (
            "configuration",
            Bundle {
                configuration_directory: "nested".into(),
                ..original.clone()
            },
            false,
        ),
        (
            "repositories",
            Bundle {
                repository_roots: vec!["/other".into()],
                ..original.clone()
            },
            false,
        ),
        (
            "resolution",
            Bundle {
                module_resolution: resolution,
                ..original.clone()
            },
            false,
        ),
    ] {
        for valid in [true, false, true] {
            current.store(valid, Ordering::Release);
            let _ = request(&runtime, &params, None).unwrap();
            assert_eq!(
                calls.lock().unwrap().last().unwrap().plan,
                (reusable && valid).then(plan),
                "{name}, current={valid}"
            );
        }
    }
    let _ = request(&runtime, &original, None).unwrap();
    assert_eq!(calls.lock().unwrap().last().unwrap().plan, Some(plan()));
}

#[test]
fn only_a_serve_head_retains_complete_durable_captured_records() {
    for (name, enabled, complete, durable, oversized) in [
        ("default runtime", false, true, true, false),
        ("incomplete", true, false, true, false),
        ("unstable", true, true, false, false),
        ("oversized", true, true, true, true),
    ] {
        let mut evidence = evidence();
        Arc::make_mut(&mut evidence).complete = complete;
        Arc::make_mut(&mut evidence).durable = durable;
        let mut plan = plan();
        if oversized {
            Arc::make_mut(&mut plan).paths[1] = "x".repeat(8 * 1024 * 1024);
        }
        let calls = Arc::new(Mutex::new(vec![]));
        let mut runtime = runtime(
            Unimock::new(()),
            vec![result(Some(plan), evidence.clone())],
            calls.clone(),
        );
        if enabled {
            runtime = runtime.with_serve_edit_plans();
        }
        let _ = request(&runtime, &params(), None).unwrap();
        assert_eq!(Arc::strong_count(&evidence), 1, "{name}");
        runtime.bundle_capture = BundleCapture::ServeEdit;
        let _ = request(&runtime, &params(), None).unwrap();
        assert_eq!(calls.lock().unwrap().last().unwrap().plan, None, "{name}");
    }
}
