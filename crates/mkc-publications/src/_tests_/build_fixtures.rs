//! Shared pure build records and unimock query fixtures.

use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use mkc_auth::runtime::{Runtime, RuntimeMock};
use mkc_domain::ids::{BuildId, InstallationId, ProjectId, RepositoryId};
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::build::Build;
use mkc_store_interface::build_check::BuildCheck;
use mkc_store_interface::build_state::{BuildState, BuildTrigger};
use mkc_store_interface::github_installation::{GitHubInstallationsMock, Installation};
use mkc_store_interface::github_refs::{Branch, PullRequest};
use mkc_store_interface::github_repository::{GitHubRepositoriesMock, Repository};
use mkc_store_interface::github_state::AccountKind;
use mkc_store_interface::organization::OrganizationsMock;
use mkc_store_interface::project::{Project, ProjectsMock};
use unimock::{Clause, MockFn, Unimock, matching};
use uuid::Uuid;

use crate::locations::Locations;
use crate::transaction::Transactions;

use super::support;

pub(crate) const BUILD: BuildId = BuildId(Uuid::from_u128(21));
pub(crate) const REPOSITORY: RepositoryId = RepositoryId(Uuid::from_u128(22));
pub(crate) const OPERATION: Uuid = Uuid::from_u128(23);
pub(crate) const LEASE: Uuid = Uuid::from_u128(24);
pub(crate) const PROJECT: ProjectId = support::PROJECT;

pub(crate) fn now() -> DateTime<Utc> {
    support::now()
}

pub(crate) fn project() -> Project {
    Project {
        automatic_builds: true,
        visibility: Visibility::Public,
        ..support::project()
    }
}

pub(crate) fn repository() -> Repository {
    Repository {
        id: REPOSITORY,
        installation_id: InstallationId(Uuid::from_u128(25)),
        github_id: 100,
        full_name: project().repository,
        default_branch: "main".into(),
        private: false,
        active: true,
    }
}

pub(crate) fn installation() -> Installation {
    Installation {
        id: repository().installation_id,
        github_id: 1,
        app_id: 1,
        organization_id: Some(project().organization_id),
        account_id: 1,
        account_name: "mokly-ai".into(),
        account_kind: AccountKind::Organization,
        manage_url: "https://github.com/settings/installations/1".into(),
        active: true,
        connected: true,
        updated_at: now(),
    }
}

pub(crate) fn branch() -> Branch {
    Branch {
        repository_id: REPOSITORY,
        name: "main".into(),
        head_sha: Some("a".repeat(40)),
        updated_at: now(),
    }
}

pub(crate) fn pull() -> PullRequest {
    PullRequest {
        repository_id: REPOSITORY,
        number: 3,
        title: "Changes".into(),
        author: Some("user".into()),
        open: true,
        merged: false,
        head_ref: "feature".into(),
        head_sha: "a".repeat(40),
        base_ref: "main".into(),
        base_sha: "b".repeat(40),
        head_repository_id: Some(100),
        base_repository_id: Some(100),
        updated_at: now(),
    }
}

pub(crate) fn build(state: BuildState) -> Build {
    let running = state == BuildState::Running;
    Build {
        id: BUILD,
        project_id: PROJECT,
        repository_id: REPOSITORY,
        trigger: BuildTrigger::Push,
        branch: "main".into(),
        head_sha: "a".repeat(40),
        pull_request: None,
        base_ref: None,
        config_path: project().config_path,
        state,
        step: None,
        attempt: i32::from(running),
        next_attempt_at: now(),
        attempt_operation_id: running.then_some(OPERATION),
        lease_token: running.then_some(LEASE),
        lease_expires_at: running.then_some(now() + Duration::minutes(2)),
        deadline_at: running.then_some(now() + Duration::minutes(15)),
        failure_cause: None,
        exit_code: None,
        publication_id: None,
        superseded_by: None,
        log_bytes: 0,
        log_head_sequence: 0,
        log_sequence: 0,
        log_elided_bytes: 0,
        log_complete: false,
        created_at: now(),
        started_at: running.then_some(now()),
        finished_at: None,
    }
}

pub(crate) fn check() -> BuildCheck {
    BuildCheck {
        build_id: BUILD,
        version: 1,
        delivered_version: 0,
        attempts: 0,
        permanent_failures: 0,
        next_attempt_at: now(),
        dead_lettered_at: None,
        claim_expires_at: None,
    }
}

pub(crate) fn eligibility(
    project: Option<Project>,
    repository: Option<Repository>,
    installation: Option<Installation>,
    plan: Plan,
) -> impl Clause {
    (
        ProjectsMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(project.clone()))),
        GitHubRepositoriesMock::github_project_repository
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(repository.clone()))),
        GitHubInstallationsMock::github_installation
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(installation.clone()))),
        OrganizationsMock::organization
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(Some(support::organization(plan))))),
    )
}

pub(crate) fn runtime() -> Arc<dyn Runtime> {
    Arc::new(Unimock::new((
        RuntimeMock::now.each_call(matching!()).returns(now()),
        RuntimeMock::id.each_call(matching!()).returns(LEASE),
        RuntimeMock::secret
            .each_call(matching!())
            .answers(&|_| Ok("a".repeat(64))),
    )))
}

pub(crate) fn clock_runtime() -> Arc<dyn Runtime> {
    support::clock()
}

pub(crate) fn id_runtime() -> Arc<dyn Runtime> {
    Arc::new(Unimock::new((
        RuntimeMock::now.each_call(matching!()).returns(now()),
        RuntimeMock::id.each_call(matching!()).returns(LEASE),
    )))
}

pub(crate) fn locations() -> Locations {
    support::locations()
}
pub(crate) fn transactions(queries: Unimock) -> Arc<dyn Transactions> {
    support::transactions(queries)
}

pub(crate) fn organization(plan: Plan) -> mkc_store_interface::organization::Organization {
    support::organization(plan)
}

pub(crate) fn publication() -> mkc_store_interface::publication::Publication {
    support::publication()
}
