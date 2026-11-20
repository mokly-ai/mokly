//! Installation availability is distinct from installable-list eligibility.

use mkc_domain::values::Role;
use mkc_store_interface::github_installation::Installation;
use mkc_store_interface::github_state::AccountKind;
use serde_json::to_value;
use uuid::Uuid;

use crate::platform::projection;
use crate::views::workspaces::InstallationState;

use super::support::{WORKSPACE, installation, now, workspace};

#[test]
fn workspace_read_omits_transitional_github_fields() {
    for installations in [Vec::new(), vec![installation()]] {
        let value = to_value(projection::workspace(
            workspace(),
            Role::Owner,
            installations,
        ))
        .unwrap();
        assert!(value.get("githubAccount").is_none(), "{value}");
        assert!(value.get("githubManageUrl").is_none(), "{value}");
    }
}

#[test]
fn workspace_summary_uses_only_connected_bindings() {
    let absent = projection::workspace(workspace(), Role::Owner, Vec::new());
    assert_eq!(absent.github_installation_state, InstallationState::Absent);
    for bound in [false, true] {
        for connected in [false, true] {
            for active in [false, true] {
                let installation = Installation {
                    id: Uuid::from_u128(7).into(),
                    github_id: 1,
                    app_id: 1,
                    organization_id: bound.then_some(WORKSPACE),
                    account_id: 1,
                    account_name: "mokly-ai".into(),
                    account_kind: AccountKind::Organization,
                    manage_url: "https://github.com/settings/installations/1".into(),
                    active,
                    connected,
                    updated_at: now(),
                };
                let view = projection::workspace(workspace(), Role::Owner, vec![installation]);
                let expected = if !bound || !connected {
                    InstallationState::Absent
                } else if active {
                    InstallationState::Connected
                } else {
                    InstallationState::Suspended
                };
                assert_eq!(view.github_installation_state, expected);
            }
        }
    }
}

#[test]
fn workspace_summary_prefers_any_active_binding_in_either_order() {
    for (first_active, second_active, expected) in [
        (false, false, InstallationState::Suspended),
        (false, true, InstallationState::Connected),
        (true, false, InstallationState::Connected),
        (true, true, InstallationState::Connected),
    ] {
        let mut first = installation();
        first.id = Uuid::from_u128(1).into();
        first.active = first_active;
        let mut second = first.clone();
        second.id = Uuid::from_u128(2).into();
        second.active = second_active;
        for installations in [vec![first.clone(), second.clone()], vec![second, first]] {
            let view = projection::workspace(workspace(), Role::Member, installations);
            assert_eq!(view.github_installation_state, expected);
        }
    }
}
