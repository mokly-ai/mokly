//! Total retention counts settings and evicts the oldest captured records.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_sidecar::compiled::PhysicalInput;
use mokly_sidecar::methods::BundleCapture;
use unimock::{MockFn, Unimock, matching};

use crate::bundle_attempt::request;
use crate::physical_inputs::PhysicalInputsMock;

use super::bundle_plan_support::{evidence, marked, params, plan, result, runtime};

#[test]
fn total_retention_evicts_the_oldest_record_and_equal_settings_replace_the_previous_record() {
    let calls = Arc::new(Mutex::new(vec![]));
    let mut large = plan();
    Arc::make_mut(&mut large)
        .imports
        .values_mut()
        .next()
        .unwrap()
        .path = "x".repeat(4 * 1024 * 1024);
    let mut runtime = runtime(
        Unimock::new(
            PhysicalInputsMock::matches
                .each_call(matching!(_, _))
                .answers(&|_, _, _| Ok(true)),
        ),
        vec![
            result(Some(large.clone()), evidence()),
            result(Some(large.clone()), evidence()),
            marked(),
            marked(),
            result(Some(plan()), evidence()),
        ],
        calls.clone(),
    )
    .with_serve_edit_plans();
    let first = params();
    let mut second = params();
    second.renderer = Some("renderer.tsx".into());
    let _ = request(&runtime, &first).unwrap();
    let _ = request(&runtime, &second).unwrap();
    runtime.bundle_capture = BundleCapture::ServeEdit;
    let _ = request(&runtime, &first).unwrap();
    assert_eq!(
        calls
            .lock()
            .unwrap()
            .last()
            .unwrap()
            .plan
            .as_ref()
            .map(|plan| plan.imports["edge"].path.len()),
        None
    );
    let _ = request(&runtime, &second).unwrap();
    assert_eq!(calls.lock().unwrap().last().unwrap().plan, Some(large));
    runtime.bundle_capture = BundleCapture::Full;
    let _ = request(&runtime, &second).unwrap();
    runtime.bundle_capture = BundleCapture::ServeEdit;
    let _ = request(&runtime, &second).unwrap();
    assert_eq!(calls.lock().unwrap().last().unwrap().plan, Some(plan()));
}

#[test]
fn retained_settings_are_charged_inside_the_total_record_bound() {
    let calls = Arc::new(Mutex::new(vec![]));
    let evidence = evidence();
    let mut runtime = runtime(
        Unimock::new(()),
        vec![result(Some(plan()), evidence.clone())],
        calls.clone(),
    )
    .with_serve_edit_plans();
    let mut params = params();
    params.renderer = Some("x".repeat(8 * 1024 * 1024));
    let _ = request(&runtime, &params).unwrap();
    assert_eq!(
        Arc::strong_count(&evidence),
        1,
        "oversized settings must not retain their evidence"
    );
    runtime.bundle_capture = BundleCapture::ServeEdit;
    let _ = request(&runtime, &params).unwrap();
    assert_eq!(calls.lock().unwrap().last().unwrap().plan, None);
}

#[test]
fn an_ineligible_later_capture_keeps_the_older_plan_and_checks_its_own_evidence() {
    for name in ["absent", "incomplete", "unstable", "oversized"] {
        let current = Arc::new(AtomicBool::new(true));
        let reads = current.clone();
        let old_evidence = evidence();
        let mut replacement_evidence = evidence();
        Arc::make_mut(&mut replacement_evidence).inputs.clear();
        let mut replacement_plan = plan();
        Arc::make_mut(&mut replacement_plan)
            .imports
            .get_mut("edge")
            .unwrap()
            .path = if name == "oversized" {
            "x".repeat(8 * 1024 * 1024)
        } else {
            "/repo/replacement.ts".into()
        };
        if name == "incomplete" {
            Arc::make_mut(&mut replacement_evidence).complete = false;
        }
        if name == "unstable" {
            Arc::make_mut(&mut replacement_evidence).durable = false;
        }
        let calls = Arc::new(Mutex::new(vec![]));
        let mut runtime = runtime(
            Unimock::new(
                PhysicalInputsMock::matches
                    .each_call(matching!(_, _))
                    .answers_arc(Arc::new(move |_, path, expected| {
                        assert_eq!(path, Path::new("/physical/config.json"));
                        assert_eq!(expected, &PhysicalInput::Absent);
                        Ok(reads.load(Ordering::Acquire))
                    })),
            ),
            vec![
                result(Some(plan()), old_evidence.clone()),
                result(
                    (name != "absent").then_some(replacement_plan),
                    replacement_evidence,
                ),
            ],
            calls.clone(),
        )
        .with_serve_edit_plans();
        let _ = request(&runtime, &params()).unwrap();
        let _ = request(&runtime, &params()).unwrap();
        assert_eq!(Arc::strong_count(&old_evidence), 2, "{name}");
        runtime.bundle_capture = BundleCapture::ServeEdit;
        for expected in [true, false, true] {
            current.store(expected, Ordering::Release);
            let _ = request(&runtime, &params()).unwrap();
            assert_eq!(
                calls.lock().unwrap().last().unwrap().plan,
                expected.then(plan),
                "{name}, current={expected}"
            );
        }
    }
}
