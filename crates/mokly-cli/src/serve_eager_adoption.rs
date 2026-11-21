//! Classification consumes only current evidence and releases every rejected pending graph.

use std::sync::atomic::Ordering;

use mokly_compare::base_freshness::FreshnessRequest;
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::error::{Error, Result};

use crate::serve_eager::AdoptedPreparation;
use crate::serve_eager_evidence::AdoptionEvidence;
use crate::serve_eager_work::{NativePreparation, WorkState};

impl NativePreparation {
    pub(super) fn current(&self, request: &BaseRetentionRequest<'_>) -> Result<bool> {
        let evidence = self
            .guard
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone();
        match evidence {
            Some(evidence) => evidence.current(
                request,
                &self.runtime.dependency_usage.directories(),
                &self.runtime.dependency_usage.unmapped_directories(),
            ),
            None => Ok(false),
        }
    }
    pub(super) fn take_prepared(
        &self,
        request: &BaseRetentionRequest<'_>,
    ) -> Result<Option<AdoptedPreparation>> {
        self.guard
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        let state = self
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        let (evidence, services, sources, prepared, root) = match state {
            Some(WorkState::Ready { context, prepared }) => (
                context.evidence,
                context.services,
                Ok(context.sources),
                Some(prepared),
                context.root,
            ),
            Some(WorkState::Failed {
                evidence,
                services,
                source,
            }) => (evidence, services, Err(source), None, None),
            Some(WorkState::Source { context, .. }) => {
                if let Some(root) = context.root {
                    self.diagnostics.finish(&root, &self.events, false);
                }
                self.events.discard();
                return Ok(None);
            }
            Some(WorkState::Unpinned(error)) => {
                tracing::debug!(%error, "unpinned eager preparation is not current");
                self.events.discard();
                return Ok(None);
            }
            None => return Ok(None),
        };
        let directories = self.runtime.dependency_usage.directories();
        let unmapped = self.runtime.dependency_usage.unmapped_directories();
        let current = evidence.current(request, &directories, &unmapped)?;
        let current = if current {
            match prepared
                .as_ref()
                .and_then(|result| result.as_ref().ok())
                .and_then(|base| base.freshness.as_ref())
            {
                Some(inputs) => {
                    let (directories, unmapped) = if inputs.selection.paths.is_some() {
                        (
                            request
                                .head
                                .catalogue()
                                .dependency_directories
                                .iter()
                                .cloned()
                                .collect::<Vec<_>>(),
                            Vec::new(),
                        )
                    } else {
                        (directories, unmapped)
                    };
                    match self.freshness.current(
                        inputs,
                        &FreshnessRequest {
                            selected: request.selected,
                            head: request.head,
                            directories: &directories,
                            unmapped: &unmapped,
                        },
                    ) {
                        Ok(current) => current,
                        Err(Error::Cancelled) => return Err(Error::Cancelled),
                        Err(error) => {
                            tracing::debug!(%error, "eager freshness evidence is unavailable");
                            false
                        }
                    }
                }
                None => {
                    prepared.as_ref().is_none_or(|prepared| prepared.is_err())
                        || services.validation.after_usage()
                }
            }
        } else {
            false
        };
        let cancelled = prepared.as_ref().is_some_and(
            |prepared| matches!(prepared, Err(error) if matches!(*error.source, Error::Cancelled)),
        );
        if !current || cancelled {
            if let Some(root) = root {
                self.diagnostics.finish(&root, &self.events, false);
            }
            self.events.discard();
            return Ok(None);
        }
        *self
            .consumed
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = root;
        Ok(Some(AdoptedPreparation {
            sources,
            prepared,
            native: services.provider,
            workers: services.workers,
            lifetime: self.lifetime.clone(),
            events: self.events.clone(),
        }))
    }

    pub(super) fn release_pending(&self) {
        self.guard
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        let state = self
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        let pending = match state {
            Some(WorkState::Source { context, .. } | WorkState::Ready { context, .. }) => {
                context.root
            }
            _ => None,
        };
        if let Some(root) = pending {
            self.diagnostics.finish(&root, &self.events, false);
        }
        let consumed = self
            .consumed
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        if let Some(root) = consumed {
            let accepted = self.accepted.load(Ordering::Acquire)
                && self.origin.reader_current()
                && !self.command.requested();
            self.diagnostics.finish(&root, &self.events, accepted);
        }
        self.events.discard();
    }
}
