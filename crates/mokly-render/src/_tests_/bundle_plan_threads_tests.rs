//! A large plan record keeps its plan only while every recorded input matches.

use std::io::{self, ErrorKind};
use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_sidecar::compiled::{PhysicalInput, ReuseEvidence};
use mokly_sidecar::methods::BundleCapture;
use mokly_source_interface::error::SourceError;
use unimock::{MockFn, Unimock, matching};

use crate::bundle_attempt::request;
use crate::physical_inputs::PhysicalInputsMock;

use super::bundle_plan_support::{params, plan, result, runtime};

const INPUTS: usize = 64;

#[derive(Clone, Copy, Debug)]
enum Change {
    Nothing,
    Mismatch(usize),
    ReadError(usize),
}

fn input(index: usize) -> String {
    format!("/physical/{index:02}.json")
}

/// Record a captured plan of `INPUTS` inputs, change one of them, and request an edit.
fn edit_keeps_plan(change: Change) -> bool {
    let evidence = Arc::new(ReuseEvidence {
        complete: true,
        durable: true,
        uncaptured: None,
        inputs: (0..INPUTS)
            .map(|index| (input(index), PhysicalInput::Absent))
            .collect(),
    });
    let physical = Unimock::new(
        PhysicalInputsMock::matches
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, path, _| match change {
                Change::Mismatch(index) if path == Path::new(&input(index)) => Ok(false),
                Change::ReadError(index) if path == Path::new(&input(index)) => {
                    Err(SourceError::Io {
                        operation: "check physical compilation input",
                        path: path.into(),
                        source: io::Error::from(ErrorKind::PermissionDenied),
                    })
                }
                _ => Ok(true),
            })),
    )
    .no_verify_in_drop();
    let calls = Arc::new(Mutex::new(vec![]));
    let mut runtime = runtime(
        physical,
        vec![result(Some(plan()), evidence)],
        calls.clone(),
    )
    .with_serve_edit_plans();
    let _ = request(&runtime, &params(), None).unwrap();
    runtime.bundle_capture = BundleCapture::ServeEdit;
    let _ = request(&runtime, &params(), None).unwrap();
    calls.lock().unwrap().last().unwrap().plan.is_some()
}

#[test]
fn a_large_record_keeps_its_plan_only_while_every_part_matches() {
    assert!(edit_keeps_plan(Change::Nothing));
    for index in [0, 1, 15, 16, 31, 32, 33, 47, 48, 62, 63] {
        assert!(
            !edit_keeps_plan(Change::Mismatch(index)),
            "a mismatch of input {index}"
        );
    }
    for index in [0, 31, 63] {
        assert!(
            !edit_keeps_plan(Change::ReadError(index)),
            "a read error of input {index}"
        );
    }
}
