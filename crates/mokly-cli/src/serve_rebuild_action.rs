//! A candidate retains its warning scope through preparation, projection, and adoption.

use std::sync::Arc;

use mokly_catalogue::diagnostic::Warning;
use mokly_cli::build::{BuildError, BuildSummary};
use mokly_cli::build_output;
use mokly_server::error::ServerError;
use mokly_watch::event::Batch;

use crate::serve_rebuild::ManualRebuilds;
use crate::serve_warnings::AttemptWarnings;

impl ManualRebuilds {
    fn failed_catalogue(&self, batch: &Batch, attempt: &dyn AttemptWarnings, error: &BuildError) {
        if let Some(watch) = &self.watching {
            watch.failed();
        }
        attempt.finish(&build_output::warning_records(error), true, &|warnings| {
            if let Some(watch) = &self.watching {
                self.reporter.watched_catalogue_failure(
                    batch,
                    &watch.plan().repository,
                    warnings,
                    error,
                );
            } else {
                self.reporter.catalogue_failure(warnings, error);
            }
        });
    }
    pub(super) fn failed_server(
        &self,
        batch: &Batch,
        attempt: &dyn AttemptWarnings,
        warnings: &[Warning],
        error: &ServerError,
    ) {
        if let Some(watch) = &self.watching {
            watch.failed();
        }
        attempt.finish(warnings, true, &|warnings| {
            if let Some(watch) = &self.watching {
                self.reporter.watched_server_failure(
                    batch,
                    &watch.plan().repository,
                    warnings,
                    error,
                );
            } else {
                self.reporter.server_failure(warnings, error);
            }
        });
    }
    pub(super) fn rebuild(
        &self,
        batch: &Batch,
        attempt: Arc<dyn AttemptWarnings>,
    ) -> Option<BuildSummary> {
        let mut prepared = match self.preparation.prepare(&self.cwd, &self.options) {
            Ok(prepared) => prepared,
            Err(error) => {
                tracing::Span::current().record("status", "error");
                self.failed_catalogue(batch, attempt.as_ref(), &error);
                return None;
            }
        };
        if !self.candidates.active() {
            return None;
        }
        let mut candidate = if let Some(watch) = &self.watching {
            match watch.candidate(&prepared) {
                Ok(candidate) => Some(candidate),
                Err(error) => {
                    self.failed_server(batch, attempt.as_ref(), &prepared.summary.warnings, &error);
                    return None;
                }
            }
        } else {
            None
        };
        if let Some(candidate) = &mut candidate
            && candidate.recheck
        {
            let first_warnings = prepared.summary.warnings.clone();
            prepared = match self.preparation.prepare(&self.cwd, &self.options) {
                Ok(prepared) => prepared,
                Err(error) => {
                    attempt.report(&first_warnings, false);
                    self.failed_catalogue(batch, attempt.as_ref(), &error);
                    return None;
                }
            };
            if let Some(watch) = &self.watching
                && let Err(error) = watch.recheck(candidate, &prepared)
            {
                attempt.report(&first_warnings, false);
                self.failed_server(batch, attempt.as_ref(), &prepared.summary.warnings, &error);
                return None;
            }
        }
        attempt.report(&prepared.summary.warnings, false);
        let previous = self.publications.current();
        let revision = previous.index.revision.checked_add(1)?;
        let mut snapshot =
            match self
                .states
                .replace(&prepared, revision, &previous, attempt.clone())
            {
                Ok(snapshot) => snapshot,
                Err(error) => {
                    self.failed_server(batch, attempt.as_ref(), &prepared.summary.warnings, &error);
                    return None;
                }
            };
        while self.candidates.active() {
            if self.writer.replace(snapshot.clone()) {
                if let (Some(watch), Some(candidate)) = (&self.watching, candidate.take()) {
                    watch.clone().adopt(candidate, &prepared);
                }
                return Some(prepared.summary);
            }
            let revision = self.publications.current().index.revision.checked_add(1)?;
            if revision <= snapshot.index.revision {
                return None;
            }
            snapshot = snapshot.at_revision(revision);
        }
        None
    }
}
