//! A scoped subscriber records final fields of actual bundle attempt spans.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex, Once};

use tracing::field::{Field, Visit};
use tracing::span::{Attributes, Id, Record};
use tracing::subscriber::Interest;
use tracing::{Event, Metadata, Subscriber};

#[derive(Clone)]
pub(super) struct Capture(Arc<Mutex<Vec<BTreeMap<String, String>>>>);

impl Default for Capture {
    fn default() -> Self {
        static INSTALLED: Once = Once::new();
        INSTALLED.call_once(|| tracing::subscriber::set_global_default(Guard).unwrap());
        Self(Arc::default())
    }
}

impl Capture {
    pub(super) fn fields(&self) -> Vec<BTreeMap<String, String>> {
        self.0.lock().unwrap().clone()
    }
}

struct Fields<'a>(&'a mut BTreeMap<String, String>);
impl Visit for Fields<'_> {
    fn record_str(&mut self, field: &Field, value: &str) {
        self.0.insert(field.name().into(), value.into());
    }
    fn record_debug(&mut self, _: &Field, _: &dyn std::fmt::Debug) {}
}

impl Subscriber for Capture {
    fn enabled(&self, _: &Metadata<'_>) -> bool {
        true
    }
    fn new_span(&self, attributes: &Attributes<'_>) -> Id {
        assert_eq!(attributes.metadata().name(), "catalogue.bundle");
        let mut fields = BTreeMap::new();
        attributes.record(&mut Fields(&mut fields));
        let mut spans = self.0.lock().unwrap();
        spans.push(fields);
        Id::from_u64(spans.len() as u64)
    }
    fn record(&self, id: &Id, values: &Record<'_>) {
        values.record(&mut Fields(
            &mut self.0.lock().unwrap()[id.into_u64() as usize - 1],
        ));
    }
    fn record_follows_from(&self, _: &Id, _: &Id) {}
    fn event(&self, _: &Event<'_>) {}
    fn enter(&self, _: &Id) {}
    fn exit(&self, _: &Id) {}
}

struct Guard;
impl Subscriber for Guard {
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
