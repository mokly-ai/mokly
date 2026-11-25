//! Bounded operator verification through the same backend boundary as builds.

use std::collections::BTreeMap;
use std::future::{Future, poll_fn};
use std::pin::Pin;
use std::time::Duration;

use mkc_build_sandbox::runner::BuildSandboxCapabilities;
use sandbox_interface::{
    BackendCreateSandboxRequest, BackendStreamProcessRequest, BackendWriteFileRequest,
    ProcessStreamEvent, ProcessStreamOutcome,
};
use thiserror::Error;
use tokio::time::timeout;

use super::fixtures::SUCCESS;

const SCRIPT: &[u8] = include_bytes!("../../../../infra/e2b/tests/assert_build_template.py");
const NODE: &str = include_str!("../../../../.nvmrc");
const BUDGET: Duration = Duration::from_secs(120);

#[derive(Debug, Error, PartialEq)]
pub(super) enum ProbeError {
    #[cfg(feature = "live-build-template")]
    #[error("[mkc-api/build-template] operator probe requires MKC_E2B_API_KEY")]
    MissingApiKey,
    #[cfg(feature = "live-build-template")]
    #[error("[mkc-api/build-template] operator probe requires MKC_E2B_BUILD_TEMPLATE")]
    MissingTemplate,
    #[cfg(feature = "live-build-template")]
    #[error("[mkc-api/build-template] candidate configuration is invalid")]
    Configuration,
    #[error("[mkc-api/build-template] candidate creation could not be recovered")]
    Create,
    #[error("[mkc-api/build-template] assertion script could not be staged")]
    Write,
    #[error("[mkc-api/build-template] assertion process could not stream")]
    Stream,
    #[error("[mkc-api/build-template] template assertion failed")]
    Assertion,
    #[error("[mkc-api/build-template] template assertion exceeded its budget")]
    Timeout,
    #[error("[mkc-api/build-template] candidate destruction failed; lifetime is the backstop")]
    Destroy,
}

pub(super) trait TemplateProbe {
    fn run(
        &self,
        request: BackendCreateSandboxRequest,
    ) -> Pin<Box<dyn Future<Output = Result<(), ProbeError>> + Send + '_>>;
}

pub(super) struct StreamTemplateProbe {
    pub(super) sandbox: BuildSandboxCapabilities,
}

impl TemplateProbe for StreamTemplateProbe {
    fn run(
        &self,
        request: BackendCreateSandboxRequest,
    ) -> Pin<Box<dyn Future<Output = Result<(), ProbeError>> + Send + '_>> {
        Box::pin(async move {
            let sandbox = match timeout(
                BUDGET,
                self.sandbox.lifecycle.create_sandbox(request.clone()),
            )
            .await
            {
                Ok(Ok(sandbox)) => sandbox,
                _ => match timeout(
                    BUDGET,
                    self.sandbox.lifecycle.recover_sandbox_create(request),
                )
                .await
                {
                    Ok(Ok(Some(sandbox))) => sandbox,
                    _ => return Err(ProbeError::Create),
                },
            };
            let result = timeout(BUDGET, async {
                if self
                    .sandbox
                    .files
                    .write_file(BackendWriteFileRequest {
                        sandbox_provider_ref: sandbox.provider_ref.clone(),
                        root: "/workspace".into(),
                        path: "assert_build_template.py".into(),
                        bytes: SCRIPT.to_vec(),
                    })
                    .await
                    .is_err()
                {
                    return Err(ProbeError::Write);
                }
                let Ok(mut stream) = self
                    .sandbox
                    .processes
                    .stream_process(BackendStreamProcessRequest {
                        sandbox_provider_ref: sandbox.provider_ref.clone(),
                        command: "python3".into(),
                        args: vec![
                            "/workspace/assert_build_template.py".into(),
                            "--node-version".into(),
                            NODE.trim().into(),
                        ],
                        cwd: Some("/workspace".into()),
                        envs: BTreeMap::from([(
                            "MKC_TEMPLATE_PROBE".into(),
                            "stream-process-added-env".into(),
                        )]),
                        stdout_limit: 32768,
                        stderr_limit: 32768,
                        deadline: BUDGET,
                        idle_timeout: BUDGET,
                    })
                    .await
                else {
                    return Err(ProbeError::Stream);
                };
                let mut stdout = Vec::new();
                let mut exited_ok = false;
                let mut completed = false;
                while let Some(event) = poll_fn(|cx| stream.as_mut().poll_next(cx)).await {
                    if completed {
                        return Err(ProbeError::Assertion);
                    }
                    match event {
                        ProcessStreamEvent::Stdout(bytes)
                            if stdout.len() + bytes.len() <= 32768 =>
                        {
                            stdout.extend(bytes);
                        }
                        ProcessStreamEvent::Started { .. } | ProcessStreamEvent::Stderr(_) => {}
                        ProcessStreamEvent::Exited { exit_code, exited } => {
                            exited_ok = exit_code == 0 && exited;
                        }
                        ProcessStreamEvent::Outcome(ProcessStreamOutcome::Completed) => {
                            completed = true;
                        }
                        _ => return Err(ProbeError::Assertion),
                    }
                }
                if exited_ok && completed && stdout == SUCCESS {
                    Ok(())
                } else {
                    Err(ProbeError::Assertion)
                }
            })
            .await;
            if !matches!(
                timeout(
                    BUDGET,
                    self.sandbox.lifecycle.destroy_sandbox(sandbox.provider_ref)
                )
                .await,
                Ok(Ok(()))
            ) {
                return Err(ProbeError::Destroy);
            }
            match result {
                Ok(result) => result,
                Err(_) => Err(ProbeError::Timeout),
            }
        })
    }
}
