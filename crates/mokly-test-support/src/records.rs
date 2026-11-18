//! Owned span and event snapshots retain the observations that tests assert.

use std::collections::BTreeMap;

use tracing::Level;
use tracing::span::Id;

/// A span snapshot uses capture-local ids and the latest recorded fields.
#[derive(Clone, Debug)]
pub struct CapturedSpan {
    /// Sequential capture-local id, starting at one.
    pub id: Id,
    /// Name of the span's tracing callsite.
    pub name: &'static str,
    /// Capture-local id of the parent, when the span has one.
    pub parent: Option<Id>,
    /// Name of the parent span, when the span has one.
    pub parent_name: Option<&'static str>,
    /// String values stay unquoted, and other values use their debug format.
    pub fields: BTreeMap<String, String>,
}

/// An event snapshot retains field order and its enclosing span names.
#[derive(Clone, Debug)]
pub struct CapturedEvent {
    /// Diagnostic level of the event.
    pub level: Level,
    /// Fields in visitor order, with each value in its debug format.
    pub fields: Vec<(String, String)>,
    /// Enclosing span names, from the root to the event's parent.
    pub scope: Vec<&'static str>,
}

/// Observe an event before the emitting call returns to the code under test.
pub trait EventObserver: Send + Sync {
    /// Record the event at its synchronous position in the operation.
    fn event(&self, event: &CapturedEvent);
}

#[derive(Default)]
pub(crate) struct Records {
    pub(crate) spans: Vec<CapturedSpan>,
    pub(crate) closed: Vec<CapturedSpan>,
    pub(crate) events: Vec<CapturedEvent>,
}
