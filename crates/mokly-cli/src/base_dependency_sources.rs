//! Extraction and clean identity reads need no head catalogue or dependency directories.

use std::sync::Arc;

use mokly_compare::base_sources::BaseSourcesRequest;
use mokly_compare::cache_types::Lease;
use mokly_compare::error::Result;
use mokly_compare::extraction::{CachedExtraction, Extraction};
use mokly_compare::inputs::{InputReader, SourceInputs};
use mokly_compare::working_inputs::{SystemWorkingInputs, WorkingInputs};
use mokly_git::tree::Limits;

use crate::base_dependencies::{DependencySources, NativeDependencies};

impl NativeDependencies {
    pub(super) fn prepare_sources(
        &self,
        request: &BaseSourcesRequest<'_>,
        existing: Option<Arc<Lease>>,
    ) -> Result<DependencySources> {
        let sources = match existing {
            Some(sources) => sources,
            None => {
                let caches = self.caches(&request.working_config.repo_root)?;
                let extraction: &dyn Extraction = &CachedExtraction {
                    repository: request.repository.clone(),
                    cache: caches.cache,
                    steps: request.steps.clone(),
                    files: Limits::default().files,
                };
                Arc::new(extraction.acquire(&request.commit)?)
            }
        };
        if let Some(routing) = &self.routing {
            routing.normal(&sources.directory);
        }
        let reader: &dyn InputReader = &SourceInputs;
        let base = reader.read(request.sources.sources.as_ref(), Limits::default())?;
        let working: &dyn WorkingInputs = &SystemWorkingInputs;
        let head = working.read(request.repository.as_ref(), &base, Limits::default())?;
        Ok(DependencySources {
            sources,
            base,
            head,
        })
    }
}
