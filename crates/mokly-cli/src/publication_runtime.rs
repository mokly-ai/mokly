//! Native publication adapter uses the same static pipeline as mokly build.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use mokly_cli::build::BuildError;
use mokly_cli::cancellation::Cancellation;
use mokly_cli::grammar::{Build, Common};
use mokly_cli::publication::build::{BuildRequest, StaticOutput};
use mokly_cli::publication::error::{Error, ExchangeResult, Result};
use mokly_cli::static_build::{Phase, Phases};
use mokly_publish::error;
use mokly_publish::runtime::{self, CommandCancellation};
use mokly_publish::snapshot::{Finalized, OutputSnapshot};
use mokly_sidecar::pool::SidecarPool;

use crate::static_runtime::{self, Context, PublicationInput};

pub(super) struct Output {
    pub(super) common: Common,
    pub(super) cancellation: CommandCancellation,
    pub(super) pool: Arc<Mutex<Option<Arc<dyn SidecarPool>>>>,
    pub(super) phases: Arc<dyn Phases>,
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
            strict: request.warnings_are_fatal,
            no_changes: request.no_changes,
        };
        let context = Context {
            cancellation: Arc::new(Cancel(self.cancellation.clone())),
            pool: self.pool.clone(),
            phases: self.phases.clone(),
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
        let artifact = match built {
            Ok((artifact, _)) => artifact,
            Err(
                BuildError::Interrupted { .. }
                | BuildError::Cancelled
                | BuildError::Static {
                    source: mokly_static::error::Error::Cancelled,
                },
            ) => {
                return Err(Error::Exchange {
                    source: error::Error::Cancelled,
                });
            }
            Err(failure) => {
                return Err(Error::Build {
                    failure: Box::new(failure),
                });
            }
        };
        self.phases.start(Phase::PreparingUpload);
        Ok(Arc::new(Finalized::new(artifact).publication()?))
    }
}

struct Cancel(CommandCancellation);
impl Cancellation for Cancel {
    fn requested(&self) -> bool {
        self.0.token.is_cancelled()
    }
    fn interrupt(&self) -> bool {
        self.0.token.cancel();
        false
    }
}

pub(super) fn config(path: &Option<String>) -> Option<PathBuf> {
    path.as_ref().map(PathBuf::from)
}
