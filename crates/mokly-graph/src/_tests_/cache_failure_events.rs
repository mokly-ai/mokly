//! Collect complete error fields to ensure restore diagnostics contain no document data.

use std::fmt;
use std::sync::{Arc, Mutex};

use tracing::field::{Field, Visit};
use tracing::span::{Attributes, Id, Record};
use tracing::{Event, Level, Metadata, Subscriber};

type Fields = Vec<(String, String)>;
type Events = Vec<(Level, Fields)>;

struct Errors(Arc<Mutex<Events>>);

struct FieldsVisitor(Fields);

impl Visit for FieldsVisitor {
    fn record_debug(&mut self, field: &Field, value: &dyn fmt::Debug) {
        self.0.push((field.name().into(), format!("{value:?}")));
    }
}

impl Subscriber for Errors {
    fn enabled(&self, _: &Metadata<'_>) -> bool {
        true
    }
    fn new_span(&self, _: &Attributes<'_>) -> Id {
        Id::from_u64(1)
    }
    fn record(&self, _: &Id, _: &Record<'_>) {}
    fn record_follows_from(&self, _: &Id, _: &Id) {}
    fn enter(&self, _: &Id) {}
    fn exit(&self, _: &Id) {}
    fn event(&self, event: &Event<'_>) {
        let mut fields = FieldsVisitor(Vec::new());
        event.record(&mut fields);
        self.0
            .lock()
            .unwrap()
            .push((*event.metadata().level(), fields.0));
    }
}

/// Capture every field so an unexpected payload field fails the owning test.
pub(super) fn capture<T>(action: impl FnOnce() -> T) -> (T, Events) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let result = tracing::subscriber::with_default(Errors(events.clone()), action);
    let events = events.lock().unwrap().clone();
    (result, events)
}
