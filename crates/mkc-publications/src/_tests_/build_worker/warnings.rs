//! Capture worker warnings with a scoped `tracing` dispatcher.
//!
//! While only one dispatcher is registered, `tracing` computes the interest
//! of a newly hit callsite from the hitting thread's default alone, so a
//! parallel test without a capture can cache "never" for the warning. A
//! process-wide idle dispatcher keeps two dispatchers registered, so every
//! interest rebuild consults the live capture.

use std::collections::BTreeMap;
use std::fmt::Debug;
use std::sync::{Arc, LazyLock, Mutex};

use tracing::field::{Field, Visit};
use tracing::span::{Attributes, Id, Record};
use tracing::{Dispatch, Event, Level, Metadata, Subscriber};

use crate::tests::build_fixtures::BUILD;

#[derive(Clone, Default)]
pub(super) struct Warnings {
    events: Arc<Mutex<Vec<BTreeMap<String, String>>>>,
}

static IDLE: LazyLock<Dispatch> = LazyLock::new(|| Dispatch::new(Warnings::default()));

/// A warning capture and the dispatcher that feeds it.
pub(super) fn capture() -> (Warnings, Dispatch) {
    LazyLock::force(&IDLE);
    let warnings = Warnings::default();
    let dispatch = Dispatch::new(warnings.clone());
    (warnings, dispatch)
}

impl Warnings {
    pub(super) fn events(&self) -> Vec<BTreeMap<String, String>> {
        self.events.lock().unwrap().clone()
    }
}

/// The exact fields of one infrastructure warning for the fixture build.
pub(super) fn warning(attempt: i32, terminal: bool, reason: &str) -> BTreeMap<String, String> {
    BTreeMap::from([
        ("attempt".to_owned(), attempt.to_string()),
        ("build_id".to_owned(), BUILD.to_string()),
        (
            "message".to_owned(),
            "build attempt ended as infrastructure".to_owned(),
        ),
        ("reason".to_owned(), reason.to_owned()),
        ("terminal".to_owned(), terminal.to_string()),
    ])
}

impl Subscriber for Warnings {
    fn enabled(&self, metadata: &Metadata<'_>) -> bool {
        *metadata.level() <= Level::WARN
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
