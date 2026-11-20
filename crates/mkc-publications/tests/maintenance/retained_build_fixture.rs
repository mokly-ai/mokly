//! A published build exercises the publication child's deliberate retain policy.

use chrono::{Duration, Utc};
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_attempt::{BuildAttempt, BuildFinish};
use mkc_store_interface::build_grant::BuildUploadGrant;
use mkc_store_interface::build_state::{BuildState, BuildTrigger};
use mkc_store_interface::error::Result;
use mkc_store_interface::github_installation::Installation;
use mkc_store_interface::github_repository::Repository;
use mkc_store_interface::github_state::AccountKind;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::Publication;
use mkc_store_interface::store::Queries;
use uuid::Uuid;

pub(super) fn populate(
    q: &mut dyn Queries,
    project: &Project,
    publication: &Publication,
) -> Result<()> {
    let now = Utc::now();
    let installation = Installation {
        id: Uuid::now_v7().into(),
        github_id: 1,
        app_id: 1,
        organization_id: Some(project.organization_id),
        account_id: 1,
        account_name: "retention".into(),
        account_kind: AccountKind::Organization,
        manage_url: "https://github.com/settings/installations/1".into(),
        active: true,
        connected: true,
        updated_at: now,
    };
    q.save_github_installation(&installation)?;
    let repository = Repository {
        id: Uuid::now_v7().into(),
        installation_id: installation.id,
        github_id: 1,
        full_name: project.repository.clone(),
        default_branch: "main".into(),
        private: false,
        active: true,
    };
    q.save_github_repository(&repository)?;
    let metadata = publication.metadata.as_ref().unwrap();
    let b = NewBuild {
        id: Uuid::now_v7().into(),
        project_id: project.id,
        repository_id: repository.id,
        trigger: BuildTrigger::Request,
        branch: metadata.branch.clone(),
        head_sha: metadata.head_sha.clone(),
        pull_request: metadata.pull_request,
        base_ref: None,
        config_path: metadata.config_path.clone(),
        created_at: now,
    };
    q.schedule_build(&b)?;
    let attempt = BuildAttempt {
        now,
        operation_id: Uuid::now_v7(),
        lease_token: Uuid::now_v7(),
        lease_expires_at: now + Duration::minutes(2),
        deadline_at: now + Duration::minutes(15),
    };
    q.start_build(b.id, &attempt)?.unwrap();
    let grant = BuildUploadGrant {
        id: Uuid::now_v7(),
        build_id: b.id,
        attempt: 1,
        token_digest: [7; 32],
        expires_at: attempt.deadline_at,
        consumed_at: None,
        outcome: None,
        created_at: now,
    };
    assert!(q.mint_build_grant(&grant)?);
    assert!(q.consume_build_grant(grant.id, publication.id, &|| now)?);
    assert!(q.finish_build(
        b.id,
        Some(attempt.lease_token),
        &BuildFinish {
            state: BuildState::Published,
            failure_cause: None,
            exit_code: None,
            at: now,
            next_attempt_at: now
        }
    )?);
    Ok(())
}
