//! Registry callbacks retain span fields, parentage, and synchronous events.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use tracing::span::{Attributes, Id, Record};
use tracing::{Event, Subscriber};
use tracing_subscriber::Layer;
use tracing_subscriber::layer::Context;
use tracing_subscriber::registry::LookupSpan;

use crate::fields::{EventFields, SpanFields};
use crate::records::{CapturedEvent, CapturedSpan, EventObserver, Records};

pub(crate) struct CaptureLayer {
    pub(crate) records: Arc<Mutex<Records>>,
    pub(crate) observer: Option<Arc<dyn EventObserver>>,
}

struct CaptureId(Id);

impl<S: Subscriber + for<'a> LookupSpan<'a>> Layer<S> for CaptureLayer {
    fn on_new_span(&self, attributes: &Attributes<'_>, id: &Id, context: Context<'_, S>) {
        let span = context.span(id).unwrap();
        let parent = span.parent().map(|parent| {
            let id = parent.extensions().get::<CaptureId>().unwrap().0.clone();
            (id, parent.name())
        });
        let mut fields = BTreeMap::new();
        attributes.record(&mut SpanFields(&mut fields));
        let capture_id = {
            let mut records = self.records.lock().unwrap();
            let id = Id::from_u64(records.spans.len() as u64 + 1);
            records.spans.push(CapturedSpan {
                id: id.clone(),
                name: span.name(),
                parent: parent.as_ref().map(|(id, _)| id.clone()),
                parent_name: parent.map(|(_, name)| name),
                fields,
            });
            id
        };
        span.extensions_mut().insert(CaptureId(capture_id));
    }

    fn on_record(&self, id: &Id, values: &Record<'_>, context: Context<'_, S>) {
        let span = context.span(id).unwrap();
        let index = span.extensions().get::<CaptureId>().unwrap().0.into_u64() as usize - 1;
        values.record(&mut SpanFields(
            &mut self.records.lock().unwrap().spans[index].fields,
        ));
    }

    fn on_close(&self, id: Id, context: Context<'_, S>) {
        let span = context.span(&id).unwrap();
        let index = span.extensions().get::<CaptureId>().unwrap().0.into_u64() as usize - 1;
        let mut records = self.records.lock().unwrap();
        let record = records.spans[index].clone();
        records.closed.push(record);
    }

    fn on_event(&self, event: &Event<'_>, context: Context<'_, S>) {
        let mut fields = EventFields::default();
        event.record(&mut fields);
        let record = CapturedEvent {
            level: *event.metadata().level(),
            fields: fields.0,
            scope: context
                .event_scope(event)
                .into_iter()
                .flat_map(|scope| scope.from_root().map(|span| span.name()))
                .collect(),
        };
        self.records.lock().unwrap().events.push(record.clone());
        if let Some(observer) = &self.observer {
            observer.event(&record);
        }
    }
}
