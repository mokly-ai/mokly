//! Closure failures must emit an ERROR event under the resource graph span.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, ThreadId};

use tracing::span::{Attributes, Id, Record};
use tracing::{Event, Level, Metadata, Subscriber};

use super::control::Control;
use super::support::{compare, source};

#[derive(Default)]
struct Trace {
    next: AtomicU64,
    spans: Mutex<HashMap<u64, &'static Metadata<'static>>>,
    entered: Mutex<HashMap<ThreadId, Vec<u64>>>,
    errors: Mutex<Vec<Vec<&'static str>>>,
}

struct Capture(Arc<Trace>, Option<Arc<Control>>);

impl Subscriber for Capture {
    fn enabled(&self, _: &Metadata<'_>) -> bool {
        true
    }
    fn new_span(&self, attributes: &Attributes<'_>) -> Id {
        let id = self.0.next.fetch_add(1, Ordering::SeqCst) + 1;
        self.0
            .spans
            .lock()
            .unwrap()
            .insert(id, attributes.metadata());
        Id::from_u64(id)
    }
    fn record(&self, _: &Id, _: &Record<'_>) {}
    fn record_follows_from(&self, _: &Id, _: &Id) {}
    fn enter(&self, id: &Id) {
        self.0
            .entered
            .lock()
            .unwrap()
            .entry(thread::current().id())
            .or_default()
            .push(id.into_u64());
    }
    fn exit(&self, _: &Id) {
        self.0
            .entered
            .lock()
            .unwrap()
            .get_mut(&thread::current().id())
            .unwrap()
            .pop();
    }
    fn event(&self, event: &Event<'_>) {
        if event.metadata().level() == &Level::ERROR {
            if let Some(control) = &self.1 {
                control.event("restore-log".into());
            }
            let entered = self.0.entered.lock().unwrap();
            let spans = self.0.spans.lock().unwrap();
            let names = entered
                .get(&thread::current().id())
                .into_iter()
                .flatten()
                .map(|id| spans[id].name())
                .collect();
            self.0.errors.lock().unwrap().push(names);
        }
    }
}

#[test]
fn closure_failure_marks_the_resource_graph_span_as_error_under_comparison() {
    let trace = Arc::new(Trace::default());
    let control = Arc::new(Control {
        fail_from: Some(2),
        ..Default::default()
    });
    let result = tracing::subscriber::with_default(Capture(trace.clone(), None), || {
        compare(source(1, 1, control.clone()), source(2, 1, control))
    });
    assert!(result.is_err());
    assert_eq!(
        *trace.errors.lock().unwrap(),
        [vec!["review.compare-views", "review.resource-graph"]]
    );
}

pub(super) fn with_errors<T>(control: Arc<Control>, run: impl FnOnce() -> T) -> T {
    tracing::subscriber::with_default(Capture(Arc::new(Trace::default()), Some(control)), run)
}
