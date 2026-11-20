//! Pure identities and unimock-backed query execution for provider tests.

use std::sync::Arc;

use mkc_auth::runtime::RuntimeMock;
use mkc_domain::ids::{InstallationId, RepositoryId};
use mkc_github_interface::check::{CheckRun, Conclusion};
use mkc_github_interface::checks::{self, Status};
use mkc_store_interface::github_check;
use mkc_store_interface::github_installation::{GitHubInstallationsMock, Installation};
use mkc_store_interface::github_repository::{GitHubRepositoriesMock, Repository};
use mkc_store_interface::github_state::AccountKind;
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::store::StoreMock;
use unimock::{Clause, MockFn, Unimock, matching};
use uuid::Uuid;

use crate::check_provider::GitHubCheckRuns;
use crate::tests::support::{PROJECT, PUBLICATION, now, project};

pub(super) fn check() -> CheckRun {
    CheckRun {
        project_id: PROJECT,
        repository: project().repository,
        head_sha: "b".repeat(40),
        external_id: format!("mokly-publication:{PUBLICATION}"),
        name: "Mokly".into(),
        status: Status::Completed,
        conclusion: Some(Conclusion::Neutral),
        title: "Catalogue published.".into(),
        summary: "Catalogue published.".into(),
        details_url: "https://app.example.com/mokly/cloud".into(),
    }
}

pub(super) fn repository() -> Repository {
    Repository {
        id: RepositoryId(Uuid::from_u128(70)),
        installation_id: InstallationId(Uuid::from_u128(71)),
        github_id: 1296269,
        full_name: "New-Owner/Renamed".into(),
        default_branch: "main".into(),
        private: false,
        active: true,
    }
}

pub(super) fn installation() -> Installation {
    Installation {
        id: repository().installation_id,
        github_id: 1,
        app_id: 123,
        organization_id: Some(project().organization_id),
        account_id: 1,
        account_name: "New-Owner".into(),
        account_kind: AccountKind::Organization,
        manage_url: "https://github.com/settings/installations/1".into(),
        active: true,
        connected: true,
        updated_at: now(),
    }
}

pub(super) fn record() -> github_check::CheckRun {
    github_check::CheckRun {
        id: Uuid::from_u128(72),
        project_id: PROJECT,
        repository_id: repository().id,
        github_id: 4,
        head_sha: check().head_sha,
        external_id: check().external_id,
        rerequested: true,
    }
}

pub(super) fn run() -> checks::CheckRun {
    checks::CheckRun {
        id: 4,
        head_sha: check().head_sha,
        external_id: Some(check().external_id),
        status: Status::Completed,
        conclusion: Some(checks::Conclusion::Neutral),
    }
}

pub(super) fn binding() -> impl Clause {
    (
        ProjectsMock::project
            .some_call(matching!(_))
            .returns(Ok(Some(project()))),
        GitHubRepositoriesMock::github_project_repository
            .some_call(matching!(_))
            .returns(Ok(Some(repository()))),
        GitHubInstallationsMock::github_installation
            .some_call(matching!(_))
            .returns(Ok(Some(installation()))),
    )
}

pub(super) fn adapter(queries: Unimock, checks: Unimock, writes: bool) -> GitHubCheckRuns {
    let queries = Arc::new(queries);
    let reads = queries.clone();
    let read = StoreMock::read
        .next_call(matching!(_))
        .answers_arc(Arc::new(move |_, work| {
            work.run(&mut reads.as_ref().clone())?;
            Ok(())
        }));
    let store = if writes {
        Unimock::new((
            read,
            StoreMock::transaction
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, work| {
                    work.run(&mut queries.as_ref().clone())?;
                    Ok(())
                })),
        ))
    } else {
        Unimock::new(read)
    };
    let runtime = if writes {
        Unimock::new(
            RuntimeMock::id
                .next_call(matching!())
                .returns(Uuid::from_u128(73)),
        )
    } else {
        Unimock::new(())
    };
    GitHubCheckRuns {
        store: Arc::new(store),
        checks: Arc::new(checks),
        runtime: Arc::new(runtime),
        app_id: 123,
    }
}
