//! Capture cleanup warnings without a global subscriber or provider text.

use std::collections::BTreeMap;
use std::fmt::Debug;
use std::sync::{Arc, Mutex};

use mkc_build_interface::request::BuildRequest;
use tracing::field::{Field, Visit};
use tracing::span::{Attributes, Id, Record};
use tracing::{Event, Level, Metadata, Subscriber};

use super::fixtures::{INSTALLATION, UPLOAD, provider};

#[derive(Clone, Default)]
pub(super) struct Warnings {
    events: Arc<Mutex<Vec<BTreeMap<String, String>>>>,
}

impl Warnings {
    pub(super) fn assert_cleanup_failure(&self, request: &BuildRequest) {
        let events = self.events.lock().unwrap();
        assert_eq!(events.len(), 1);
        let fields = &events[0];
        assert_eq!(
            fields.keys().map(String::as_str).collect::<Vec<_>>(),
            ["attempt_operation_id", "build_id", "failure", "message"]
        );
        assert_eq!(fields["build_id"], request.build_id.to_string());
        assert_eq!(
            fields["attempt_operation_id"],
            request.attempt_operation_id.to_string()
        );
        assert_eq!(fields["failure"], "Destroy");
        for value in [INSTALLATION, UPLOAD, provider().as_str()] {
            assert!(!format!("{fields:?}").contains(value));
        }
    }
}

impl Subscriber for Warnings {
    fn enabled(&self, metadata: &Metadata<'_>) -> bool {
        *metadata.level() == Level::WARN
    }

    fn new_span(&self, _span: &Attributes<'_>) -> Id {
        Id::from_u64(1)
    }

    fn record(&self, _span: &Id, _values: &Record<'_>) {}

    fn record_follows_from(&self, _span: &Id, _follows: &Id) {}

    fn event(&self, event: &Event<'_>) {
        assert_eq!(*event.metadata().level(), Level::WARN);
        let mut fields = Fields(BTreeMap::new());
        event.record(&mut fields);
        self.events.lock().unwrap().push(fields.0);
    }

    fn enter(&self, _span: &Id) {}

    fn exit(&self, _span: &Id) {}
}

struct Fields(BTreeMap<String, String>);

impl Visit for Fields {
    fn record_debug(&mut self, field: &Field, value: &dyn Debug) {
        self.0.insert(field.name().into(), format!("{value:?}"));
    }
}
