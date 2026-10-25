//! A synchronous trace observer captures fields at the private cleanup boundary.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex, Once};

use tracing::field::{Field, Visit};
use tracing::span::{Attributes, Id, Record};
use tracing::subscriber::Interest;
use tracing::{Event, Metadata, Subscriber};

#[derive(Clone)]
pub(crate) struct Trace(Arc<Mutex<State>>);

impl Default for Trace {
    /// Install the process-wide interest guard before the first capture.
    fn default() -> Self {
        static GUARD: Once = Once::new();
        GUARD.call_once(|| {
            tracing::subscriber::set_global_default(InterestGuard)
                .expect("the sidecar tests own the global trace dispatcher");
        });
        Self(Arc::default())
    }
}

/// The global dispatcher of the test process. It enables nothing, but it keeps
/// every callsite's cached interest at `sometimes`, so each span asks the
/// dispatcher of its own thread. Without it, while one scoped capture is the
/// only dispatcher, `tracing-core` takes a new callsite's interest from the
/// thread that registers it first; a thread without a capture caches `never`
/// and disables that span for the capture too.
struct InterestGuard;

impl Subscriber for InterestGuard {
    fn register_callsite(&self, _: &'static Metadata<'static>) -> Interest {
        Interest::sometimes()
    }
    fn enabled(&self, _: &Metadata<'_>) -> bool {
        false
    }
    fn new_span(&self, _: &Attributes<'_>) -> Id {
        Id::from_u64(1)
    }
    fn record(&self, _: &Id, _: &Record<'_>) {}
    fn record_follows_from(&self, _: &Id, _: &Id) {}
    fn event(&self, _: &Event<'_>) {}
    fn enter(&self, _: &Id) {}
    fn exit(&self, _: &Id) {}
}

#[derive(Default)]
struct State {
    spans: Vec<Span>,
    active: Vec<Id>,
    closed: Vec<Span>,
    references: Vec<usize>,
}

#[derive(Clone)]
pub(crate) struct Span {
    metadata: &'static Metadata<'static>,
    pub(crate) parent: Option<Id>,
    pub(crate) fields: BTreeMap<String, String>,
}

impl Visit for Span {
    fn record_str(&mut self, field: &Field, value: &str) {
        self.fields.insert(field.name().into(), value.into());
    }
    fn record_debug(&mut self, _: &Field, _: &dyn std::fmt::Debug) {}
}

impl Trace {
    pub(crate) fn stopped(&self) -> Vec<Span> {
        self.closed("sidecar.stop")
    }

    pub(crate) fn closed(&self, name: &str) -> Vec<Span> {
        self.0
            .lock()
            .unwrap()
            .closed
            .iter()
            .filter(|span| span.metadata.name() == name)
            .cloned()
            .collect()
    }
}

impl Subscriber for Trace {
    fn enabled(&self, _: &Metadata<'_>) -> bool {
        true
    }
    fn new_span(&self, attributes: &Attributes<'_>) -> Id {
        let mut state = self.0.lock().unwrap();
        let mut span = Span {
            metadata: attributes.metadata(),
            parent: attributes.parent().cloned().or_else(|| {
                attributes
                    .is_contextual()
                    .then(|| state.active.last().cloned())
                    .flatten()
            }),
            fields: BTreeMap::new(),
        };
        attributes.record(&mut span);
        state.spans.push(span);
        state.references.push(1);
        Id::from_u64(state.spans.len() as u64)
    }
    fn record(&self, id: &Id, values: &Record<'_>) {
        values.record(&mut self.0.lock().unwrap().spans[id.into_u64() as usize - 1]);
    }
    fn record_follows_from(&self, _: &Id, _: &Id) {}
    fn event(&self, _: &Event<'_>) {}
    fn enter(&self, id: &Id) {
        self.0.lock().unwrap().active.push(id.clone());
    }
    fn exit(&self, _: &Id) {
        self.0.lock().unwrap().active.pop();
    }
    fn clone_span(&self, id: &Id) -> Id {
        self.0.lock().unwrap().references[id.into_u64() as usize - 1] += 1;
        id.clone()
    }
    fn try_close(&self, id: Id) -> bool {
        let mut state = self.0.lock().unwrap();
        let count = &mut state.references[id.into_u64() as usize - 1];
        *count -= 1;
        if *count != 0 {
            return false;
        }
        let span = state.spans[id.into_u64() as usize - 1].clone();
        state.closed.push(span);
        true
    }
}

#[cfg(test)]
#[path = "trace_capture_tests.rs"]
mod trace_capture_tests;
