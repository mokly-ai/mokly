//! One preparation outcome crosses completed usage before retention or comparison.

use std::sync::Arc;

use crate::base_classification::{Attempt, base_error};
use crate::base_render::{BaseRequest, Changes, PreparationCheckpoint, PreparedBase};
use crate::base_retention::{BaseRetentionRequest, KeptBase};
use crate::error::{Error, Result};
use crate::source_failures::SourceFailures;

struct Capture {
    prepared: PreparedBase,
    failures: Arc<dyn SourceFailures>,
}

impl Changes {
    pub(super) fn prepare_attempt(&self, request: &BaseRetentionRequest<'_>) -> Result<Attempt> {
        let prepared = self.prepare_capture(request).and_then(|prepared| {
            if self
                .provider
                .checkpoint(request, PreparationCheckpoint::Capture)?
            {
                self.capture_candidate(request, prepared).map(Some)
            } else {
                Ok(None)
            }
        });
        let current = self
            .provider
            .checkpoint(request, PreparationCheckpoint::Complete)?;
        let base = match (prepared, current) {
            (Ok(Some(base)), true) => base,
            (Err(error), true) => return Err(error),
            _ => {
                self.provider.restarting();
                let prepared = self.prepare_capture(request).and_then(|prepared| {
                    self.provider
                        .checkpoint(request, PreparationCheckpoint::Capture)?;
                    self.capture_candidate(request, prepared)
                });
                self.provider
                    .checkpoint(request, PreparationCheckpoint::Complete)?;
                prepared?
            }
        };
        let reuse = match self.provider.keep(request, base.clone()) {
            Ok(reuse) => reuse,
            Err(source) => {
                self.provider.release(&base);
                return Err(base_error(
                    &request.selected.commit.to_string(),
                    base.scripts_off,
                    source,
                ));
            }
        };
        Ok(Attempt {
            base,
            reuse,
            fallback: false,
        })
    }

    fn prepare_capture(&self, request: &BaseRetentionRequest<'_>) -> Result<Capture> {
        let commit = &request.selected.commit;
        let sources = self.sources.create(
            request.selected.repository.clone(),
            commit.clone(),
            &request.working_config.repo_root,
        )?;
        let failures = sources.failures.clone();
        let prepared = self.provider.prepare(&BaseRequest {
            head: request.head,
            working_config: request.working_config,
            repository: request.selected.repository.clone(),
            commit: commit.clone(),
            sources,
            install_scripts: request.install_scripts,
            steps: self.steps.clone(),
        });
        let scripts_off = prepared
            .as_ref()
            .map_or_else(|error| error.scripts_off, |base| base.scripts_off);
        if let Some(source) = failures.failure() {
            return Err(base_error(
                &commit.to_string(),
                scripts_off,
                Error::SourceFailure { source },
            ));
        }
        let prepared = match prepared {
            Ok(prepared) => prepared,
            Err(error) => return Err(base_error(&commit.to_string(), scripts_off, *error.source)),
        };
        Ok(Capture { prepared, failures })
    }

    fn capture_candidate(
        &self,
        request: &BaseRetentionRequest<'_>,
        capture: Capture,
    ) -> Result<Arc<KeptBase>> {
        let Capture { prepared, failures } = capture;
        let commit = &request.selected.commit;
        let scripts_off = prepared.scripts_off;
        let captured = self.comparison.capture_base(prepared.generation);
        if let Some(source) = failures.failure() {
            return Err(base_error(
                &commit.to_string(),
                scripts_off,
                Error::SourceFailure { source },
            ));
        }
        let generation = match captured {
            Ok(generation) => generation,
            Err(source) => return Err(base_error(&commit.to_string(), scripts_off, source)),
        };
        Ok(Arc::new(KeptBase {
            generation,
            failures,
            scripts_off,
            freshness: prepared.freshness,
        }))
    }
}
