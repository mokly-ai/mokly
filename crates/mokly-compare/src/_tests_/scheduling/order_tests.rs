//! Completion order cannot replace document, closure, or ordered Phase B failures.

use std::sync::Arc;

use mokly_graph::error::GraphError;

use crate::error::Error;

use super::control::Control;
use super::support::{captured, compare, source};

fn error_path(error: Error) -> String {
    let Error::Graph {
        source: GraphError::InputsChanged { path },
    } = error
    else {
        panic!("expected graph input failure")
    };
    path.to_string_lossy().into()
}

#[test]
fn later_preparation_failure_finishes_first_but_the_earlier_view_keeps_error_priority() {
    for phase_b in [false, true] {
        let control = Arc::new(Control {
            errors: if phase_b { [1].into() } else { [0, 1].into() },
            resource_error: phase_b.then_some(0),
            later_first: true,
            ..Default::default()
        });
        let before = captured(source(1, 2, control.clone()), &[0, 1]);
        let after = source(2, 2, control.clone());
        let error = compare(before.clone(), after.clone()).unwrap_err();
        assert_eq!(
            error_path(error),
            if phase_b { "phase-b-0" } else { "phase-a-0" }
        );
        let events = control.events.lock().unwrap();
        assert_eq!(
            events
                .iter()
                .filter(|event| event.starts_with("complete:"))
                .cloned()
                .collect::<Vec<_>>(),
            ["complete:1", "complete:0"]
        );
        assert_eq!(control.live(), 0);
    }
}

#[test]
fn an_earlier_error_leaves_a_later_deferred_base_source_unread() {
    let control = Arc::new(Control {
        errors: [0].into(),
        later_first: true,
        has_deferred: true,
        ..Default::default()
    });
    let error = compare(
        captured(source(1, 2, control.clone()), &[0]),
        source(2, 2, control.clone()),
    )
    .unwrap_err();
    assert_eq!(error_path(error), "phase-a-0");
    let events = control.events.lock().unwrap();
    assert_eq!(
        events
            .iter()
            .filter(|event| event.starts_with("document:"))
            .cloned()
            .collect::<Vec<_>>(),
        ["document:2:0"]
    );
}

#[test]
fn deferred_reads_preserve_base_document_head_document_base_closure_head_closure_priority() {
    let expected = ["document:1:0", "document:2:0", "closure:1:0", "closure:2:0"];
    for stage in 0..4 {
        let control = Arc::new(Control {
            fail_from: Some(stage),
            ..Default::default()
        });
        let error =
            compare(source(1, 1, control.clone()), source(2, 1, control.clone())).unwrap_err();
        assert_eq!(error_path(error), format!("stage-{stage}"));
        let events = control.events.lock().unwrap();
        assert_eq!(
            events
                .iter()
                .filter(|event| !event.starts_with("complete:"))
                .map(String::as_str)
                .collect::<Vec<_>>(),
            expected[..=stage]
        );
    }
}
