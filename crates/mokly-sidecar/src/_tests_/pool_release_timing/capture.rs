//! A synchronous trace observer captures fields at the private cleanup boundary.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use tracing::field::{Field, Visit};
use tracing::span::{Attributes, Id, Record};
use tracing::{Event, Metadata, Subscriber};

#[derive(Clone, Default)]
pub(super) struct Trace(Arc<Mutex<State>>);

#[derive(Default)]
struct State {
    spans: Vec<Span>,
    active: Vec<Id>,
    closed: Vec<Span>,
}

#[derive(Clone)]
pub(super) struct Span {
    pub(super) metadata: &'static Metadata<'static>,
    pub(super) parent: Option<Id>,
    pub(super) fields: BTreeMap<String, String>,
}

impl Visit for Span {
    fn record_str(&mut self, field: &Field, value: &str) {
        self.fields.insert(field.name().into(), value.into());
    }
    fn record_debug(&mut self, _: &Field, _: &dyn std::fmt::Debug) {}
}

impl Trace {
    pub(super) fn stopped(&self) -> Vec<Span> {
        self.0
            .lock()
            .unwrap()
            .closed
            .iter()
            .filter(|span| span.metadata.name() == "sidecar.stop")
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
    fn try_close(&self, id: Id) -> bool {
        let mut state = self.0.lock().unwrap();
        let span = state.spans[id.into_u64() as usize - 1].clone();
        state.closed.push(span);
        true
    }
}
