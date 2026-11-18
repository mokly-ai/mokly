//! Closure failures must emit an ERROR event under the resource graph span.

use std::sync::Arc;

use mokly_test_support::capture::Trace;
use mokly_test_support::records::{CapturedEvent, EventObserver};
use tracing::Level;

use super::control::Control;
use super::support::{compare, source};

impl EventObserver for Control {
    fn event(&self, event: &CapturedEvent) {
        if event.level == Level::ERROR {
            Control::event(self, "restore-log".into());
        }
    }
}

#[test]
fn closure_failure_marks_the_resource_graph_span_as_error_under_comparison() {
    let trace = Trace::default();
    let control = Arc::new(Control {
        fail_from: Some(2),
        ..Default::default()
    });
    let result = trace.in_scope(|| compare(source(1, 1, control.clone()), source(2, 1, control)));
    assert!(result.is_err());
    assert_eq!(
        trace
            .events()
            .into_iter()
            .filter(|event| event.level == Level::ERROR)
            .map(|event| event.scope)
            .collect::<Vec<_>>(),
        [vec!["review.compare-views", "review.resource-graph"]]
    );
}

pub(super) fn with_errors<T>(control: Arc<Control>, run: impl FnOnce() -> T) -> T {
    Trace::with_observer(control).in_scope(run)
}
