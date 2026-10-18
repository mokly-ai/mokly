//! A trace layer records parentage and final status without reading a real clock.

use std::sync::{Arc, Mutex};

use tracing::Subscriber;
use tracing::field::{Field, Visit};
use tracing::span::{Attributes, Id, Record};
use tracing_subscriber::Layer;
use tracing_subscriber::layer::Context;
use tracing_subscriber::registry::LookupSpan;

#[derive(Clone, Debug)]
pub(crate) struct Recorded {
    pub(crate) name: &'static str,
    pub(crate) parent: Option<&'static str>,
    pub(crate) status: Option<String>,
}
impl Visit for Recorded {
    fn record_debug(&mut self, _: &Field, _: &dyn std::fmt::Debug) {}
    fn record_str(&mut self, field: &Field, value: &str) {
        if field.name() == "status" {
            self.status = Some(value.into());
        }
    }
}

#[derive(Clone, Default)]
pub(crate) struct Traces(Arc<Mutex<Vec<Recorded>>>);
impl Traces {
    pub(crate) fn records(&self) -> Vec<Recorded> {
        self.0.lock().unwrap().clone()
    }
}
impl<S: Subscriber + for<'a> LookupSpan<'a>> Layer<S> for Traces {
    fn on_new_span(&self, attributes: &Attributes<'_>, id: &Id, context: Context<'_, S>) {
        let parent = attributes
            .parent()
            .and_then(|id| context.span(id))
            .or_else(|| context.lookup_current());
        let mut record = Recorded {
            name: attributes.metadata().name(),
            parent: parent.map(|span| span.name()),
            status: None,
        };
        attributes.record(&mut record);
        context.span(id).unwrap().extensions_mut().insert(record);
    }
    fn on_record(&self, id: &Id, values: &Record<'_>, context: Context<'_, S>) {
        values.record(
            context
                .span(id)
                .unwrap()
                .extensions_mut()
                .get_mut::<Recorded>()
                .unwrap(),
        );
    }
    fn on_close(&self, id: Id, context: Context<'_, S>) {
        self.0.lock().unwrap().push(
            context
                .span(&id)
                .unwrap()
                .extensions()
                .get::<Recorded>()
                .unwrap()
                .clone(),
        );
    }
}
