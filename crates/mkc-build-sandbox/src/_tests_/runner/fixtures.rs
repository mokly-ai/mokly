//! Pure build request and sandbox identity fixtures.

use std::time::Duration;

use chrono::{DateTime, TimeDelta, Utc};
use mkc_build_interface::input::{Branch, ConfigPath, HeadSha, Repository, UploadEndpoint};
use mkc_build_interface::request::{BuildRequest, Comparison};
use mkc_build_interface::secret::Secret;
use mkc_domain::ids::ProjectId;
use sandbox_interface::{
    BackendCreateSandboxRequest, BackendSandbox, OperationId, ProviderRef, ResourceOwner,
    SandboxConsumer, SandboxId, SandboxLifetime, SandboxNetworkPolicy, SandboxState,
};
use uuid::Uuid;

pub(super) const INSTALLATION: &str = "ghs_installationSecret0123456789";
pub(super) const UPLOAD: &str =
    "mkb_abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd";
pub(super) const SHA: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

pub(super) fn request() -> BuildRequest {
    let project_id = ProjectId(Uuid::from_u128(3));
    BuildRequest {
        build_id: Uuid::from_u128(1),
        attempt_operation_id: Uuid::from_u128(2),
        project_id,
        repository: Repository::new("owner/repo").unwrap(),
        head_sha: HeadSha::new(SHA).unwrap(),
        branch: Branch::new("feature/builds").unwrap(),
        comparison: Comparison::CurrentOnly,
        config_path: ConfigPath::new("mokly.config.json").unwrap(),
        deadline_at: now() + TimeDelta::seconds(900),
        upload_endpoint: UploadEndpoint::new(
            &format!("https://api.mokly.ai/v1/projects/{project_id}/publications"),
            project_id,
        )
        .unwrap(),
        upload_token: Secret::new(UPLOAD).unwrap(),
        installation_token: Secret::new(INSTALLATION).unwrap(),
    }
}

pub(super) fn now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-03T12:00:00Z")
        .unwrap()
        .with_timezone(&Utc)
}
pub(super) fn provider() -> ProviderRef {
    ProviderRef::new("sandbox-test-provider")
}
pub(super) fn sandbox() -> BackendSandbox {
    BackendSandbox {
        provider_ref: provider(),
        state: SandboxState::Ready,
    }
}

pub(super) fn create(request: &BuildRequest, lifetime: u64) -> BackendCreateSandboxRequest {
    BackendCreateSandboxRequest {
        sandbox_id: SandboxId::from_uuid(request.build_id),
        operation_id: OperationId::from_uuid(request.attempt_operation_id),
        owner: ResourceOwner::platform(request.project_id.0),
        consumer: SandboxConsumer::Runtime,
        lifetime: SandboxLifetime::OneShot {
            max_lifetime: Duration::from_secs(lifetime),
        },
        deployment_id: "test-builds".into(),
        profile: "build".into(),
        network: SandboxNetworkPolicy::Open,
        snapshot_provider_ref: None,
        size: None,
    }
}
