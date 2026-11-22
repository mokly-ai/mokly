//! Per-worker encoding leaves only bounded encoded outputs and validation facts.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use crate::collection_input::{ComparisonEncoder, EncodedComparisonDocument};
use crate::error::Result;
use crate::session::Session;
use crate::session_collection;
use crate::types::{ComparisonDocument, RenderGeneration};
use crate::workers::{ComparisonTask, ComparisonWorker, ValidatedView};

pub(crate) struct Completed {
    pub(crate) view: Result<ValidatedView>,
    pub(crate) encoded: Option<Result<EncodedComparisonDocument>>,
}

/// Each output's charge is calculated once, then transferred at its route turn.
#[derive(Default)]
pub(crate) struct Outputs {
    values: BTreeMap<usize, (usize, Completed)>,
    bytes: usize,
}

pub(crate) struct Jobs<'a> {
    pub(crate) session: &'a Session,
    pub(crate) routes: Vec<String>,
    pub(crate) encoder: Arc<dyn ComparisonEncoder>,
    pub(crate) outputs: Mutex<Outputs>,
}

impl ComparisonTask for Jobs<'_> {
    fn run(&self, index: usize) {
        let route = &self.routes[index];
        let input = self.session.input(route);
        let completed = match input {
            Ok(input) => {
                let view = Ok(session_collection::view(route, &input));
                let encoded = Some(self.session.check_cancelled().and_then(|()| {
                    EncodedComparisonDocument::encode(route, input, self.encoder.as_ref())
                }));
                Completed { view, encoded }
            }
            Err(error) => Completed {
                view: Err(error),
                encoded: None,
            },
        };
        let charge = match &completed.encoded {
            Some(Ok(input)) => input.retained_bytes(route),
            _ => 0,
        };
        let mut outputs = self
            .outputs
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        outputs.bytes = outputs.bytes.saturating_add(charge);
        outputs.values.insert(index, (charge, completed));
    }
}

impl ComparisonWorker for Session {
    fn input(&self, route: &str) -> Result<ComparisonDocument> {
        self.check_cancelled()?;
        self.validation_input(route, true)
    }
}

impl Jobs<'_> {
    pub(crate) fn take(&self, index: usize) -> Option<Completed> {
        let mut outputs = self
            .outputs
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let (charge, completed) = outputs.values.remove(&index)?;
        outputs.bytes -= charge;
        Some(completed)
    }

    pub(crate) fn queued_bytes(&self) -> usize {
        self.outputs
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .bytes
    }
}
