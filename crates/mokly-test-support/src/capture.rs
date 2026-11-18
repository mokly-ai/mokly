//! A stable Registry dispatcher captures scoped work across shared test threads.

use std::sync::{Arc, Mutex};

use tracing::Dispatch;
use tracing_subscriber::layer::SubscriberExt;

use crate::capture_layer::CaptureLayer;
use crate::interest_guard;
use crate::records::{CapturedEvent, CapturedSpan, EventObserver, Records};

/// One capture shares its records and dispatcher across every clone.
#[derive(Clone)]
pub struct Trace {
    records: Arc<Mutex<Records>>,
    dispatcher: Dispatch,
}

impl Default for Trace {
    fn default() -> Self {
        Self::new(None)
    }
}

impl Trace {
    /// Create a capture that also reports each event synchronously.
    pub fn with_observer(observer: Arc<dyn EventObserver>) -> Self {
        Self::new(Some(observer))
    }

    fn new(observer: Option<Arc<dyn EventObserver>>) -> Self {
        interest_guard::install();
        let records = Arc::new(Mutex::new(Records::default()));
        let layer = CaptureLayer {
            records: records.clone(),
            observer,
        };
        let dispatcher = Dispatch::new(tracing_subscriber::registry().with(layer));
        Self {
            records,
            dispatcher,
        }
    }

    /// Install this capture's dispatcher for one synchronous closure.
    pub fn in_scope<T>(&self, run: impl FnOnce() -> T) -> T {
        tracing::dispatcher::with_default(&self.dispatcher, run)
    }

    /// Clone the dispatcher for a test-owned worker or runtime thread.
    pub fn dispatcher(&self) -> Dispatch {
        self.dispatcher.clone()
    }

    /// Read every span in creation order, including spans still open.
    pub fn spans(&self) -> Vec<CapturedSpan> {
        self.records.lock().unwrap().spans.clone()
    }

    /// Read matching spans in close order after their final reference drops.
    pub fn closed(&self, name: &str) -> Vec<CapturedSpan> {
        self.records
            .lock()
            .unwrap()
            .closed
            .iter()
            .filter(|span| span.name == name)
            .cloned()
            .collect()
    }

    /// Read every event in observation order.
    pub fn events(&self) -> Vec<CapturedEvent> {
        self.records.lock().unwrap().events.clone()
    }
}
