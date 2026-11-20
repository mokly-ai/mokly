//! Filtered installation reads prove workspace membership before querying bindings.

use mkc_domain::values::Role;
use mkc_store_interface::github_installation::{GitHubInstallationsMock, Installation};
use mkc_store_interface::github_state::AccountKind;
use mkc_store_interface::member::MembersMock;
use unimock::{MockFn, Unimock, matching};

use crate::error::ApiError;
use crate::github::listing_input::InstallationsQuery;
use crate::github::service::GitHubIntegration;

use super::support::{INSTALLATION, USER, WORKSPACE, member, now, read_service};

#[test]
fn an_inaccessible_workspace_is_not_found_without_reading_installations() {
    let service = read_service(Unimock::new(
        MembersMock::members
            .some_call(matching!(&WORKSPACE))
            .returns(Ok(Vec::new())),
    ));
    assert!(matches!(
        service.installations(USER, Some(WORKSPACE)),
        Err(ApiError::NotFound)
    ));
}

#[test]
fn a_member_reads_connected_and_suspended_rows_but_not_local_disconnects() {
    let mut suspended = Installation {
        id: INSTALLATION,
        github_id: 1,
        app_id: 123,
        organization_id: Some(WORKSPACE),
        account_id: 1,
        account_name: "fixture-org".into(),
        account_kind: AccountKind::Organization,
        manage_url: "https://github.com/settings/installations/1".into(),
        active: false,
        connected: true,
        updated_at: now(),
    };
    let mut active = suspended.clone();
    active.id = uuid::Uuid::from_u128(99).into();
    active.active = true;
    let disconnected = {
        suspended.connected = false;
        suspended.clone()
    };
    suspended.connected = true;
    let service = read_service(Unimock::new((
        MembersMock::members
            .some_call(matching!(&WORKSPACE))
            .returns(Ok(vec![member(Role::Member)])),
        GitHubInstallationsMock::github_installations
            .some_call(matching!(&WORKSPACE))
            .returns(Ok(vec![suspended, active, disconnected])),
    )));
    let rows = serde_json::to_value(service.installations(USER, Some(WORKSPACE)).unwrap()).unwrap();
    assert_eq!(rows.as_array().unwrap().len(), 2);
    assert_eq!(rows[0]["workspaceId"], WORKSPACE.to_string());
    assert_eq!(rows[0]["accountKind"], "organization");
    assert_eq!(rows[0]["state"], "suspended");
    assert_eq!(rows[1]["state"], "connected");
}

#[test]
fn installation_filter_parsing_keeps_shared_paging_and_rejects_duplicate_keys() {
    let query = InstallationsQuery::parse(&format!("workspaceId={WORKSPACE}&limit=1")).unwrap();
    assert_eq!(query.workspace_id, Some(WORKSPACE));
    assert_eq!(query.page.limit, 1);
    for value in [
        "workspaceId=",
        "workspaceId=not-a-uuid",
        "limit=0",
        "unknown=x",
        "limit=1&limit=2",
    ] {
        assert!(InstallationsQuery::parse(value).is_err(), "{value}");
    }
    assert!(
        InstallationsQuery::parse(&format!("workspaceId={WORKSPACE}&workspaceId={WORKSPACE}"))
            .is_err()
    );
}
