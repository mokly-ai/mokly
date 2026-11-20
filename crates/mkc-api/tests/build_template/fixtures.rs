//! Safe candidate correlation data and the template assertion's expected output.

use std::sync::Arc;
use std::time::Duration;

use futures_util::stream;
use sandbox_interface::{
    BackendCreateSandboxRequest, BackendSandbox, BackendStreamProcessRequest,
    BackendWriteFileRequest, Error, OperationId, ProcessStreamEvent, ProviderRef, ResourceOwner,
    SandboxBackend, SandboxBackendMock, SandboxConsumer, SandboxId, SandboxLifetime,
    SandboxNetworkPolicy, SandboxState,
};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

pub(super) const SUCCESS: &[u8] =
    b"PASS build template: tools, user, workspace, credentials and merged environment\n";

pub(super) fn sandbox() -> BackendSandbox {
    BackendSandbox {
        provider_ref: ProviderRef::new("candidate"),
        state: SandboxState::Ready,
    }
}

pub(super) fn stream_backend(
    events: Vec<ProcessStreamEvent>,
    destroy_fails: bool,
) -> Arc<dyn SandboxBackend> {
    Arc::new(Unimock::new((
        SandboxBackendMock::create_sandbox
            .some_call(matching!(_))
            .returns(Ok(sandbox())),
        SandboxBackendMock::write_file
            .some_call(matching!(_))
            .answers_arc(Arc::new(|_, request: BackendWriteFileRequest| {
                assert_eq!(request.root, "/workspace");
                assert_eq!(request.path, "assert_build_template.py");
                assert!(request.bytes.starts_with(b"#!/usr/bin/env python3"));
                Ok(())
            })),
        SandboxBackendMock::stream_process
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, request: BackendStreamProcessRequest| {
                assert_eq!(request.command, "python3");
                assert_eq!(request.cwd.as_deref(), Some("/workspace"));
                assert_eq!(request.envs.len(), 1);
                assert_eq!(
                    request.envs["MKC_TEMPLATE_PROBE"],
                    "stream-process-added-env"
                );
                assert!(!request.envs.contains_key("PATH"));
                assert!(!request.envs.contains_key("HOME"));
                assert_eq!(request.args[0], "/workspace/assert_build_template.py");
                assert_eq!(request.args[1], "--node-version");
                assert_eq!(request.args[2], include_str!("../../../../.nvmrc").trim());
                assert_eq!(request.deadline, Duration::from_secs(120));
                assert_eq!(request.idle_timeout, request.deadline);
                assert_eq!(request.stdout_limit, 32768);
                assert_eq!(request.stderr_limit, 32768);
                Ok(Box::pin(stream::iter(events.clone())))
            })),
        SandboxBackendMock::destroy_sandbox
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, provider: ProviderRef| {
                assert_eq!(provider, sandbox().provider_ref);
                if destroy_fails {
                    Err(Error::internal_message("never-print-this-provider-secret"))
                } else {
                    Ok(())
                }
            })),
    )))
}

pub(super) fn request() -> BackendCreateSandboxRequest {
    BackendCreateSandboxRequest {
        sandbox_id: SandboxId::from_uuid(Uuid::now_v7()),
        operation_id: OperationId::from_uuid(Uuid::now_v7()),
        owner: ResourceOwner::platform(Uuid::now_v7()),
        consumer: SandboxConsumer::Runtime,
        lifetime: SandboxLifetime::OneShot {
            max_lifetime: Duration::from_secs(360),
        },
        deployment_id: "mokly-build-template-probe".into(),
        profile: "build".into(),
        network: SandboxNetworkPolicy::Open,
        snapshot_provider_ref: None,
    }
}
