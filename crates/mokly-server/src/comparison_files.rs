//! Generation lookup never redirects and never revives collected generations.

use std::collections::BTreeMap;
use std::sync::Arc;

use async_trait::async_trait;
use mokly_model::namespace::GENERATED_DIRECTORY;
use mokly_model::review_affected::ReviewSide;
use mokly_model::routes;

use crate::assets::File;
use crate::changes::Accepted;
use crate::comparison_requests::receive;
use crate::comparison_store::{self, Bundle, Comparisons, MemoryComparisons, Outcome};
use crate::error::{Result, ServerError};

#[async_trait]
impl Comparisons for MemoryComparisons {
    fn check_capacity(&self, accepted: &Accepted, files: &BTreeMap<String, File>) -> Result<()> {
        self.collect();
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if state.closed || accepted.cancel.cancelled() {
            return Err(ServerError::ChangesReplaced);
        }
        comparison_store::admit(&state, &accepted.id, files)
    }

    fn install(&self, accepted: Arc<Accepted>, files: BTreeMap<String, File>) -> Result<()> {
        self.collect();
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if state.closed || accepted.cancel.cancelled() {
            return Err(ServerError::ChangesReplaced);
        }
        comparison_store::admit(&state, &accepted.id, &files)?;
        state
            .bundles
            .entry(accepted.id.clone())
            .and_modify(|bundle| bundle.accepted = Some(accepted.clone()))
            .or_insert_with(|| Bundle {
                files,
                accepted: Some(accepted),
                touched: self.clock.milliseconds(),
            });
        Ok(())
    }

    async fn selected(&self, accepted: Arc<Accepted>, path: String, refresh: bool) -> Outcome {
        receive(self.begin(accepted, path, false, refresh)?).await
    }

    async fn file(&self, generation: &str, path: &str) -> Result<Option<File>> {
        let capture = {
            self.collect();
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            let Some(bundle) = state.bundles.get_mut(generation) else {
                return Ok(None);
            };
            if let Some(file) = bundle.files.get(path) {
                bundle.touched = self.clock.milliseconds();
                return Ok(Some(file.clone()));
            }
            let Some(accepted) = &bundle.accepted else {
                return Ok(None);
            };
            let Some(route) = path.strip_prefix(&routes::comparison_snapshot(
                ReviewSide::Before,
                &format!("{GENERATED_DIRECTORY}/"),
            )) else {
                return Ok(None);
            };
            let Some(plan) = accepted.result.before.plans().get(route) else {
                return Ok(None);
            };
            let Some(entry) = accepted
                .result
                .before
                .catalogue()
                .model
                .entries
                .get(plan.entry)
            else {
                return Ok(None);
            };
            if !accepted
                .result
                .snapshot
                .removed_entries
                .iter()
                .any(|removed| removed.entry.metadata().path == entry.metadata.path)
            {
                return Ok(None);
            }
            bundle.touched = self.clock.milliseconds();
            (accepted.clone(), entry.metadata.path.clone())
        };
        let pending = match self.begin(capture.0, capture.1, true, false) {
            Ok(pending) => pending,
            Err(_) => return Err(ServerError::ComparisonCapacity),
        };
        match receive(pending).await {
            Ok(_) => {
                let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
                Ok(state
                    .bundles
                    .get(generation)
                    .and_then(|bundle| bundle.files.get(path))
                    .cloned())
            }
            Err(_) => Err(ServerError::ChangesUnavailable),
        }
    }

    fn collect(&self) {
        let current = self.publications.current();
        comparison_store::collect(
            &mut self.state.lock().unwrap_or_else(|error| error.into_inner()),
            self.clock.milliseconds(),
            current.changes.as_ref(),
        );
    }

    async fn stop(&self) {
        let (tasks, cancellations) = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            state.closed = true;
            let mut cancellations: Vec<_> = state
                .pending
                .values()
                .flat_map(|pending| [pending.cancel.clone(), pending.source.clone()])
                .collect();
            cancellations.extend(state.bundles.values().filter_map(|bundle| {
                bundle
                    .accepted
                    .as_ref()
                    .map(|accepted| accepted.cancel.clone())
            }));
            self.serial.close();
            (std::mem::take(&mut state.tasks), cancellations)
        };
        for cancel in cancellations {
            cancel.cancel();
        }
        for task in tasks {
            let _ = task.await;
        }
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.bundles.clear();
        state.selections.clear();
    }
}
