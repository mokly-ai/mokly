//! A delayed authorization snapshot cannot override a newer access revocation.

use chrono::Duration;
use mkc_github_interface::repositories;
use mkc_store_interface::github_installation::{GitHubInstallationsMock, Installation};
use mkc_store_interface::github_state::AccountKind;
use unimock::{MockFn, Unimock, matching};

use crate::error::ApiError;
use crate::github::reconciliation::{InstallationUpdate, Snapshot};

use super::support::{INSTALLATION, WORKSPACE, github_user, now};

#[test]
fn stale_binding_cannot_restore_a_newer_suspension_or_disconnection() {
    let existing = Installation {
        id: INSTALLATION,
        github_id: 1,
        app_id: 123,
        organization_id: None,
        account_id: 1,
        account_name: "octocat".into(),
        account_kind: AccountKind::User,
        manage_url: "https://github.com/settings/installations/1".into(),
        active: false,
        connected: false,
        updated_at: now() + Duration::seconds(1),
    };
    let mut queries = Unimock::new(
        GitHubInstallationsMock::github_installation_by_provider
            .some_call(matching!(1))
            .returns(Ok(Some(existing))),
    );
    let snapshot: &dyn InstallationUpdate = &Snapshot::Available {
        id: INSTALLATION,
        installation: mkc_github_interface::repositories::Installation {
            id: 1,
            app_id: 123,
            account: super::support::github_user(),
            html_url: "https://github.com/settings/installations/1".into(),
            suspended_at: None,
        },
        repositories: Vec::new(),
        observed_at: now(),
    };
    assert!(matches!(
        snapshot.apply(&mut queries, Some(WORKSPACE)),
        Err(ApiError::Unavailable)
    ));
}

#[test]
fn enterprise_and_bot_snapshots_do_not_persist_unsupported_installations() {
    for kind in [
        repositories::AccountKind::Enterprise,
        repositories::AccountKind::Bot,
    ] {
        let mut account = github_user();
        account.kind = kind;
        let mut queries = Unimock::new(
            GitHubInstallationsMock::github_installation_by_provider
                .some_call(matching!(1))
                .returns(Ok(None)),
        );
        let snapshot: &dyn InstallationUpdate = &Snapshot::Available {
            id: INSTALLATION,
            installation: repositories::Installation {
                id: 1,
                app_id: 123,
                account,
                html_url: "https://github.com/settings/installations/1".into(),
                suspended_at: None,
            },
            repositories: Vec::new(),
            observed_at: now(),
        };
        assert!(matches!(
            snapshot.apply(&mut queries, None),
            Err(ApiError::PermissionDenied)
        ));
    }
}
