//! Edit plan admission uses its typed directory reader and preserves other inputs.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_sidecar::compiled::PhysicalInput;
use mokly_sidecar::methods::BundleCapture;
use mokly_sidecar::resolution_plan::DirectoryCandidates;
use unimock::{MockFn, Unimock, matching};

use crate::bundle_attempt::request;
use crate::physical_inputs::PhysicalInputsMock;

use super::bundle_plan_support::{evidence, params, plan, result, runtime};

#[test]
fn edit_plan_directories_use_candidates_while_missing_selectors_keep_whole_checks() {
    let current = Arc::new(AtomicBool::new(true));
    let reads = current.clone();
    let physical = Unimock::new((
        PhysicalInputsMock::matches
            .each_call(matching!((path, _, _) if *path == Path::new("/physical/config.json")))
            .answers(&|_, _, _, _| Ok(true)),
        PhysicalInputsMock::matches_candidates
            .each_call(
                matching!((path, expected, names, _) if *path == Path::new("/physical")
                && matches!(expected, PhysicalInput::Directory { entries } if entries.is_empty())
                && *names == ["value.ts"]),
            )
            .answers_arc(Arc::new(move |_, _, _, _, _| {
                Ok(reads.load(Ordering::Acquire))
            })),
    ));
    let mut evidence = evidence();
    Arc::make_mut(&mut evidence).inputs.insert(
        "/physical".into(),
        PhysicalInput::Directory { entries: vec![] },
    );
    let mut plan = plan();
    let data = Arc::make_mut(&mut plan);
    data.paths.push("/physical".into());
    data.candidates = Some(vec![DirectoryCandidates(2, vec!["value.ts".into()])]);
    let calls = Arc::new(Mutex::new(vec![]));
    let mut runtime = runtime(
        physical,
        vec![result(Some(plan.clone()), evidence)],
        calls.clone(),
    )
    .with_serve_edit_plans();
    let _ = request(&runtime, &params(), None).unwrap();
    runtime.bundle_capture = BundleCapture::ServeEdit;
    for expected in [true, false] {
        current.store(expected, Ordering::Release);
        let _ = request(&runtime, &params(), None).unwrap();
        assert_eq!(
            calls.lock().unwrap().last().unwrap().plan,
            expected.then(|| plan.clone())
        );
    }
}
