//! Injectable operation for one build attempt.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use crate::log::BuildLogSink;
use crate::outcome::BuildOutcome;
use crate::request::BuildRequest;

/// Runs one build without persistence, HTTP or scheduling.
#[unimock::unimock(api = BuildRunnerMock)]
pub trait BuildRunner: Send + Sync {
    /// Run to one outcome; dropping the future requests sandbox destruction.
    fn run(
        &self,
        request: BuildRequest,
        sink: Arc<dyn BuildLogSink>,
    ) -> Pin<Box<dyn Future<Output = BuildOutcome> + Send + '_>>;
}
