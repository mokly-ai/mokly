//! Historical source preparation has no dependency on a head generation.

use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_git::identity::ObjectId;
use mokly_git::repository::Repository;

use crate::base_render::{BaseRequest, HistoricalSources};
use crate::comparison_steps::Steps;

/// Inputs available as soon as a working configuration validates.
pub struct BaseSourcesRequest<'a> {
    /// Validated working configuration locates historical configuration.
    pub working_config: &'a ResolvedConfig,
    /// Commit-pinned repository with tracked cancellation.
    pub repository: Arc<dyn Repository>,
    /// Immutable historical identity.
    pub commit: ObjectId,
    /// Source readers for that identity.
    pub sources: &'a HistoricalSources,
    /// Effective lifecycle script policy.
    pub install_scripts: bool,
    /// Ordered comparison progress recorder.
    pub steps: Arc<dyn Steps>,
}

impl BaseRequest<'_> {
    /// Borrow the source-only inputs without inventing head evidence.
    pub fn source_request(&self) -> BaseSourcesRequest<'_> {
        BaseSourcesRequest {
            working_config: self.working_config,
            repository: self.repository.clone(),
            commit: self.commit.clone(),
            sources: &self.sources,
            install_scripts: self.install_scripts,
            steps: self.steps.clone(),
        }
    }
}
