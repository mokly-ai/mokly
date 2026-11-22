//! One ordered preparation record becomes public only through the adopting origin.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_catalogue::diagnostic::Warning;
use mokly_compare::cache_types::Reporter;
use mokly_compare::comparison_steps::{Step, Steps};
use mokly_model::public_metadata::ChangesStatus;
use mokly_server::changes::ChangeProgress;
use mokly_server::error::Result;

#[derive(Clone, Debug, PartialEq)]
pub enum PreparationEvent {
    Step(Step),
    Status(ChangesStatus),
    Cache(PathBuf),
    Warnings(Vec<Warning>),
    Diagnostic(String),
}

#[cfg_attr(test, unimock::unimock(api = PreparationSinkMock))]
pub(super) trait PreparationSink: Send + Sync {
    fn report(&self, event: &PreparationEvent) -> Result<bool>;
}

pub(super) trait PreparationEvents: Steps + Reporter + ChangeProgress {
    fn warnings(&self, warnings: Vec<Warning>);
    fn adopt(&self, sink: Arc<dyn PreparationSink>) -> Result<bool>;
    fn discard(&self);
    fn diagnostic(&self, message: String);
}

#[derive(Default)]
enum Delivery {
    #[default]
    Pending,
    Adopted(Arc<dyn PreparationSink>),
    Discarded,
}

#[derive(Default)]
struct Record {
    events: Vec<PreparationEvent>,
    delivery: Delivery,
}

#[derive(Default)]
pub(super) struct OrderedEvents {
    record: Mutex<Record>,
}

impl OrderedEvents {
    fn report(&self, event: PreparationEvent) -> Result<bool> {
        let mut record = self
            .record
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        match &record.delivery {
            Delivery::Pending => {
                record.events.push(event);
                Ok(true)
            }
            Delivery::Adopted(sink) => sink.report(&event),
            Delivery::Discarded => Ok(false),
        }
    }
}

impl Steps for OrderedEvents {
    fn step(&self, step: Step) {
        let _ = self.report(PreparationEvent::Step(step));
    }
}

impl Reporter for OrderedEvents {
    fn opened(&self, directory: &Path) {
        let _ = self.report(PreparationEvent::Cache(directory.into()));
    }
}

impl ChangeProgress for OrderedEvents {
    fn status(&self, status: ChangesStatus) -> Result<bool> {
        self.report(PreparationEvent::Status(status))
    }
}

impl PreparationEvents for OrderedEvents {
    fn diagnostic(&self, message: String) {
        let _ = self.report(PreparationEvent::Diagnostic(message));
    }
    fn warnings(&self, warnings: Vec<Warning>) {
        let _ = self.report(PreparationEvent::Warnings(warnings));
    }
    fn adopt(&self, sink: Arc<dyn PreparationSink>) -> Result<bool> {
        let mut record = self
            .record
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if matches!(record.delivery, Delivery::Discarded) {
            return Ok(false);
        }
        for event in &record.events {
            if !sink.report(event)? {
                record.events.clear();
                record.delivery = Delivery::Discarded;
                return Ok(false);
            }
        }
        record.events.clear();
        record.delivery = Delivery::Adopted(sink);
        Ok(true)
    }
    fn discard(&self) {
        let mut record = self
            .record
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        record.events.clear();
        record.delivery = Delivery::Discarded;
    }
}
