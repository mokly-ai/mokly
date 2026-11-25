//! Provider-neutral fake runner used by the configured HTTP server smoke.

use std::collections::BTreeMap;
use std::future::{Future, pending};
use std::pin::Pin;
use std::sync::{Arc, Mutex};

use mkc_api::build_providers::{BuildProviderFactory, BuildProviders};
use mkc_api::error::Result;
use mkc_build_interface::log::{BuildLogChunk, BuildLogSink, BuildStream};
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_build_interface::request::{BuildRequest, Comparison};
use mkc_build_interface::runner::BuildRunner;
use mkc_build_sandbox::runner::BuildSandboxCapabilities;
use mkc_config::builds::BuildSettings;
use tokio::sync::Notify;
use unimock::Unimock;
use uuid::Uuid;

use super::build_exchange;

pub(super) type RunRecords = Arc<Mutex<Vec<RunRecord>>>;

/// Optional publication releases keyed by the real build identifier.
pub(super) type PublishSignals = Arc<Mutex<BTreeMap<Uuid, Arc<Notify>>>>;

pub(super) struct RunRecord {
    pub(super) build: Uuid,
    pub(super) head: String,
    pub(super) branch: String,
    pub(super) comparison: Comparison,
}

#[derive(Clone, Copy)]
pub(super) enum RunMode {
    Fail,
    Publish,
    Wait,
}

pub(super) struct RecordedBuildProviders {
    pub(super) mode: RunMode,
    pub(super) runs: RunRecords,
    pub(super) backend: Unimock,
    /// Hold uploads until the browser releases the build it is reading.
    pub(super) publish_signals: Option<PublishSignals>,
}

impl BuildProviderFactory for RecordedBuildProviders {
    fn create(&self, _: &BuildSettings) -> Result<BuildProviders> {
        Ok(BuildProviders {
            runner: Arc::new(RecordedRunner {
                mode: self.mode,
                runs: self.runs.clone(),
                publish_signals: self.publish_signals.clone(),
            }),
            sandbox: {
                let backend = Arc::new(self.backend.clone());
                BuildSandboxCapabilities {
                    lifecycle: backend.clone(),
                    files: backend.clone(),
                    processes: backend,
                }
            },
        })
    }
}

struct RecordedRunner {
    mode: RunMode,
    runs: RunRecords,
    publish_signals: Option<PublishSignals>,
}

impl BuildRunner for RecordedRunner {
    fn run(
        &self,
        request: BuildRequest,
        sink: Arc<dyn BuildLogSink>,
    ) -> Pin<Box<dyn Future<Output = BuildOutcome> + Send + '_>> {
        Box::pin(async move {
            assert!(
                request
                    .upload_endpoint
                    .as_str()
                    .ends_with(&format!("/v1/projects/{}/publications", request.project_id))
            );
            assert_eq!(request.repository.as_str(), "octocat/Hello-World");
            assert!(request.upload_token.expose().starts_with("mkb_"));
            assert_eq!(
                request.installation_token.expose(),
                "ghs_sanitized_installation_fixture"
            );
            self.runs.lock().unwrap().push(RunRecord {
                build: request.build_id,
                head: request.head_sha.as_str().into(),
                branch: request.branch.as_str().into(),
                comparison: request.comparison.clone(),
            });
            let publish_signal = self.publish_signals.as_ref().map(|signals| {
                let signal = Arc::new(Notify::new());
                signals
                    .lock()
                    .unwrap()
                    .insert(request.build_id, signal.clone());
                signal
            });
            sink.step_started(request.attempt_operation_id, BuildStep::Publish)
                .await
                .unwrap();
            sink.write(BuildLogChunk {
                attempt_operation_id: request.attempt_operation_id,
                step: BuildStep::Publish,
                stream: BuildStream::Stdout,
                bytes: b"Recorded build output\n".to_vec(),
            })
            .await
            .unwrap();
            match self.mode {
                RunMode::Fail => BuildOutcome::UnsupportedMoklyVersion,
                RunMode::Wait => pending().await,
                RunMode::Publish => {
                    if let Some(signal) = publish_signal {
                        signal.notified().await;
                    }
                    tokio::task::spawn_blocking(move || build_exchange::publish(&request))
                        .await
                        .unwrap();
                    BuildOutcome::Completed
                }
            }
        })
    }
}
