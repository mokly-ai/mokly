//! Native publication adapter uses the same static pipeline as mokly build.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use mokly_cli::cancellation::Cancellation;
use mokly_cli::grammar::{Build, Common};
use mokly_cli::output::Style;
use mokly_cli::publication::build::{BuildRequest, StaticOutput};
use mokly_cli::publication::error::{ExchangeResult, Result};
use mokly_cli::publication::mapping;
use mokly_cli::redaction::Redactor;
use mokly_cli::static_build::{Phase, Phases};
use mokly_graph::cache::RenderCache;
use mokly_publish::runtime;
use mokly_publish::snapshot::{Finalized, OutputSnapshot};
use mokly_sidecar::pool::SidecarPool;

use crate::static_runtime::{self, Context, PublicationInput};

pub(super) struct Output {
    pub(super) style: Style,
    pub(super) redactor: Arc<Redactor>,
    pub(super) common: Common,
    pub(super) cancellation: Arc<dyn Cancellation>,
    pub(super) pool: Arc<Mutex<Option<Arc<dyn SidecarPool>>>>,
    pub(super) phases: Arc<dyn Phases>,
    pub(super) cache: Arc<dyn RenderCache>,
}
impl StaticOutput for Output {
    fn build(
        &self,
        request: &BuildRequest,
        _: &dyn runtime::Cancellation,
    ) -> Result<Arc<dyn OutputSnapshot>> {
        let options = Build {
            common: Common {
                config: request
                    .config
                    .as_ref()
                    .map(|path| path.to_string_lossy().into_owned()),
                base: request.base.clone(),
                ..self.common.clone()
            },
            out: Some(request.directory.to_string_lossy().into_owned()),
            strict: request.strict,
            no_changes: request.no_changes,
        };
        let context = Context {
            style: self.style.clone(),
            redactor: self.redactor.clone(),
            cancellation: self.cancellation.clone(),
            pool: self.pool.clone(),
            phases: self.phases.clone(),
            cache: self.cache.clone(),
        };
        let publication = PublicationInput {
            identity: request.publication.clone(),
            repository: request.repository_root.clone(),
        };
        let built = static_runtime::run(
            &request.invocation_directory,
            &options,
            &context,
            Some(publication),
        );
        let artifact = mapping::build_result(built)?.0;
        self.phases.start(Phase::PreparingUpload);
        Ok(Arc::new(Finalized::new(artifact).publication()?))
    }
}

pub(super) fn config(path: &Option<String>) -> Option<PathBuf> {
    path.as_ref().map(PathBuf::from)
}
