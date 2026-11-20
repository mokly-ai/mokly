//! Access loss, invalid identity and retry classification never create false delivery.

use std::sync::Arc;

use mkc_github_interface::check::{CheckRuns, Error};
use mkc_github_interface::checks::{ChecksMock, Status};
use mkc_github_interface::error;
use mkc_store_interface::github_check::GitHubChecksMock;
use mkc_store_interface::github_installation::GitHubInstallationsMock;
use mkc_store_interface::github_repository::GitHubRepositoriesMock;
use mkc_store_interface::project::ProjectsMock;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::check_provider::GitHubCheckRuns;
use crate::tests::support::project;

use super::support::{adapter, binding, check, installation, record, repository, run};

#[test]
fn unbound_projects_make_no_provider_request() {
    let queries = Unimock::new((
        ProjectsMock::project
            .next_call(matching!(_))
            .returns(Ok(Some(project()))),
        GitHubRepositoriesMock::github_project_repository
            .next_call(matching!(_))
            .returns(Ok(None)),
    ));
    adapter(queries, Unimock::new(()), false)
        .upsert(&check())
        .unwrap();
}

#[test]
fn disconnected_uninstalled_and_foreign_organization_installations_are_skipped() {
    for case in ["disconnect", "uninstall", "foreign"] {
        let mut installation = installation();
        match case {
            "disconnect" => installation.connected = false,
            "uninstall" => {
                installation.connected = false;
                installation.active = false;
                installation.organization_id = None;
            }
            _ => installation.organization_id = None,
        }
        let queries = Unimock::new((
            ProjectsMock::project
                .next_call(matching!(_))
                .returns(Ok(Some(project()))),
            GitHubRepositoriesMock::github_project_repository
                .next_call(matching!(_))
                .returns(Ok(Some(repository()))),
            GitHubInstallationsMock::github_installation
                .next_call(matching!(_))
                .returns(Ok(Some(installation))),
        ));
        adapter(queries, Unimock::new(()), false)
            .upsert(&check())
            .unwrap();
    }
}

#[test]
fn suspension_is_transient_even_if_it_deactivated_repository_selection() {
    let mut installation = installation();
    installation.active = false;
    let mut repository = repository();
    repository.active = false;
    let queries = Unimock::new((
        ProjectsMock::project
            .next_call(matching!(_))
            .returns(Ok(Some(project()))),
        GitHubRepositoriesMock::github_project_repository
            .next_call(matching!(_))
            .returns(Ok(Some(repository))),
        GitHubInstallationsMock::github_installation
            .next_call(matching!(_))
            .returns(Ok(Some(installation))),
        GitHubChecksMock::github_check_by_external_id
            .next_call(matching!(_, _))
            .returns(Ok(None)),
    ));
    assert!(
        !adapter(queries, Unimock::new(()), false)
            .upsert(&check())
            .unwrap_err()
            .is_permanent()
    );
}

#[test]
fn provider_errors_keep_their_permanent_or_transient_retry_class() {
    for (error, permanent) in [
        (error::Error::InvalidRequest, true),
        (error::Error::Unauthorized, true),
        (error::Error::Forbidden, true),
        (error::Error::NotFound, true),
        (error::Error::Http { status: 422 }, true),
        (error::Error::Http { status: 408 }, false),
        (error::Error::RateLimited { retry_after: 120 }, false),
        (error::Error::Unavailable, false),
        (error::Error::internal(error::Error::Unavailable), false),
    ] {
        let queries = Unimock::new((
            binding(),
            GitHubChecksMock::github_check_by_external_id
                .next_call(matching!(_, _))
                .returns(Ok(Some(record()))),
        ));
        let checks = Unimock::new(
            ChecksMock::update
                .next_call(matching!(_, _, _, _))
                .returns(Err(error)),
        );
        assert_eq!(
            adapter(queries, checks, false)
                .upsert(&check())
                .unwrap_err()
                .is_permanent(),
            permanent
        );
    }
}

#[test]
fn invalid_lifecycle_fails_before_store_or_provider_access() {
    for (status, conclusion) in [
        (Status::Queued, check().conclusion),
        (Status::Completed, None),
    ] {
        let mut value = check();
        value.status = status;
        value.conclusion = conclusion;
        assert!(matches!(
            GitHubCheckRuns {
                store: Arc::new(Unimock::new(())),
                checks: Arc::new(Unimock::new(())),
                runtime: Arc::new(Unimock::new(())),
                app_id: 123
            }
            .upsert(&value),
            Err(Error::Validation)
        ));
    }
}

#[test]
fn wrong_head_in_a_recovered_provider_run_is_retryable_and_never_recorded() {
    let queries = Unimock::new((
        binding(),
        GitHubChecksMock::github_check_by_external_id
            .next_call(matching!(_, _))
            .returns(Ok(None)),
    ));
    let mut wrong = run();
    wrong.head_sha = "c".repeat(40);
    let checks = Unimock::new(
        ChecksMock::list
            .next_call(matching!(_, _, _, _))
            .returns(Ok(vec![wrong])),
    );
    assert!(
        !adapter(queries, checks, false)
            .upsert(&check())
            .unwrap_err()
            .is_permanent()
    );
}

#[test]
fn failed_list_or_create_never_records_a_provider_identity() {
    for failed_operation in ["list", "create"] {
        let queries = Unimock::new((
            binding(),
            GitHubChecksMock::github_check_by_external_id
                .next_call(matching!(_, _))
                .returns(Ok(None)),
        ));
        let checks = if failed_operation == "list" {
            Unimock::new(
                ChecksMock::list
                    .next_call(matching!(_, _, _, _))
                    .returns(Err(error::Error::Unavailable)),
            )
        } else {
            Unimock::new((
                ChecksMock::list
                    .next_call(matching!(_, _, _, _))
                    .returns(Ok(vec![])),
                ChecksMock::create
                    .next_call(matching!(_, _, _))
                    .returns(Err(error::Error::Unavailable)),
            ))
        };
        assert!(
            !adapter(queries, checks, false)
                .upsert(&check())
                .unwrap_err()
                .is_permanent()
        );
    }
}

#[test]
fn recorded_identity_mismatch_fails_before_provider_access() {
    for mismatch in ["repository", "head"] {
        let mut record = record();
        if mismatch == "repository" {
            record.repository_id = Uuid::from_u128(999).into();
        } else {
            record.head_sha = "c".repeat(40);
        }
        let queries = Unimock::new((
            binding(),
            GitHubChecksMock::github_check_by_external_id
                .next_call(matching!(_, _))
                .returns(Ok(Some(record))),
        ));
        assert!(matches!(
            adapter(queries, Unimock::new(()), false).upsert(&check()),
            Err(Error::Validation)
        ));
    }
}
