//! Span fields keep raw strings while event fields keep complete debug values.

use std::collections::BTreeMap;
use std::fmt;

use tracing::field::{Field, Visit};

pub(crate) struct SpanFields<'a>(pub(crate) &'a mut BTreeMap<String, String>);

impl Visit for SpanFields<'_> {
    fn record_str(&mut self, field: &Field, value: &str) {
        self.0.insert(field.name().into(), value.into());
    }

    fn record_debug(&mut self, field: &Field, value: &dyn fmt::Debug) {
        self.0.insert(field.name().into(), format!("{value:?}"));
    }
}

#[derive(Default)]
pub(crate) struct EventFields(pub(crate) Vec<(String, String)>);

impl Visit for EventFields {
    fn record_debug(&mut self, field: &Field, value: &dyn fmt::Debug) {
        self.0.push((field.name().into(), format!("{value:?}")));
    }
}
