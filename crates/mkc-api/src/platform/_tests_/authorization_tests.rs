//! Execute each action class and compare its role matrix to the protocol table.

use std::collections::BTreeMap;

use mkc_domain::values::{Role, Visibility};
use uuid::Uuid;

use crate::action::Action;
use crate::billing::error::Error as BillingError;
use crate::billing::service::{Permission, authorize};
use crate::builds::reads::authorize as authorize_builds;
use crate::error::ApiError;
use crate::input::{CreateProject, Delete, Invite, Rename, RoleUpdate, UpdateProject, Version};
use crate::operation::Operation;
use crate::platform::error::Error as PlatformError;
use crate::platform::execution::Command;
use crate::project_input::InstalledProject;

use super::query_fixture::queries;
use super::support::{PROJECT, REPOSITORY, WORKSPACE, execution};

#[derive(Debug)]
enum Capability {
    Platform(Action),
    Billing(Operation),
    Build,
}

fn capabilities() -> BTreeMap<&'static str, Vec<Capability>> {
    BTreeMap::from([
        (
            "Read workspace and its projects",
            vec![
                Capability::Platform(Action::Workspace(WORKSPACE)),
                Capability::Platform(Action::Project(PROJECT)),
            ],
        ),
        (
            "Create project",
            vec![Capability::Platform(Action::CreateProject(
                WORKSPACE,
                CreateProject::Installed(InstalledProject {
                    repository_id: REPOSITORY.0,
                    name: "Project".into(),
                    slug: "project".parse().unwrap(),
                    config_path: "mokly.config.json".into(),
                }),
            ))],
        ),
        (
            "Rename workspace, invite/manage non-owners",
            vec![
                Capability::Platform(Action::RenameWorkspace(
                    WORKSPACE,
                    Rename {
                        name: "Changed".into(),
                        slug: "changed".parse().unwrap(),
                        version: 1,
                    },
                )),
                Capability::Platform(Action::Invite(
                    WORKSPACE,
                    Invite {
                        email: "invited@example.com".into(),
                        role: Role::Member,
                    },
                )),
                Capability::Platform(Action::UpdateMember(
                    WORKSPACE,
                    Uuid::from_u128(20).into(),
                    RoleUpdate {
                        role: Role::Reviewer,
                        version: 1,
                    },
                )),
            ],
        ),
        (
            "Promote/demote/remove an owner; delete workspace",
            vec![
                Capability::Platform(Action::UpdateMember(
                    WORKSPACE,
                    Uuid::from_u128(20).into(),
                    RoleUpdate {
                        role: Role::Owner,
                        version: 1,
                    },
                )),
                Capability::Platform(Action::RemoveMember(
                    WORKSPACE,
                    Uuid::from_u128(20).into(),
                    Version { version: 1 },
                )),
                Capability::Platform(Action::DeleteWorkspace(
                    WORKSPACE,
                    Delete {
                        confirmation_name: "Team".into(),
                        version: 1,
                    },
                )),
            ],
        ),
        (
            "Administer every workspace project",
            vec![Capability::Platform(Action::UpdateProject(
                PROJECT,
                UpdateProject {
                    automatic_builds: None,
                    name: "Changed".into(),
                    slug: "changed".parse().unwrap(),
                    visibility: Visibility::Public,
                    require_approval: false,
                    version: 1,
                },
            ))],
        ),
        ("Request a build", vec![Capability::Build]),
        ("Cancel a build", vec![Capability::Build]),
        (
            "Change Automatic builds",
            vec![Capability::Platform(Action::UpdateProject(
                PROJECT,
                UpdateProject {
                    automatic_builds: Some(false),
                    name: "Project".into(),
                    slug: "project".parse().unwrap(),
                    visibility: Visibility::Public,
                    require_approval: false,
                    version: 1,
                },
            ))],
        ),
        (
            "Read billing status, seats and renewal facts",
            vec![Capability::Billing(Operation::GetBilling)],
        ),
        (
            "Start Checkout, open the Customer Portal",
            vec![
                Capability::Billing(Operation::StartCheckout),
                Capability::Billing(Operation::OpenBillingPortal),
            ],
        ),
    ])
}

fn documented_matrix() -> BTreeMap<&'static str, Vec<bool>> {
    let doc = include_str!("../../../../../docs/protocol/cloud/platform-model.md");
    let roles = doc
        .split_once("## Roles\n")
        .unwrap()
        .1
        .split("\n## ")
        .next()
        .unwrap();
    let mut rows = roles
        .lines()
        .filter(|line| line.starts_with('|'))
        .map(|line| {
            line.trim_matches('|')
                .split('|')
                .map(str::trim)
                .collect::<Vec<_>>()
        });
    assert_eq!(
        rows.next().unwrap(),
        ["Action", "Owner", "Admin", "Member", "Reviewer"]
    );
    rows.next().unwrap();
    rows.map(|cells| {
        assert_eq!(cells.len(), 5);
        (
            cells[0],
            cells[1..]
                .iter()
                .map(|cell| match *cell {
                    "Yes" => true,
                    "No" => false,
                    other => panic!("unexpected role permission {other}"),
                })
                .collect(),
        )
    })
    .collect()
}

#[test]
fn each_workspace_role_obeys_every_capability_in_the_protocol_table() {
    let mut executed = BTreeMap::new();
    for (capability, actions) in capabilities() {
        let mut permissions = Vec::new();
        for role in [Role::Owner, Role::Admin, Role::Member, Role::Reviewer] {
            let outcomes: Vec<_> = actions
                .iter()
                .map(|capability| match capability {
                    Capability::Platform(action) => {
                        match execution(action).execute(&mut queries(Some(role), action)) {
                            Ok(_) => true,
                            Err(PlatformError::Forbidden) => false,
                            other => panic!("{role:?} {capability:?}: {other:?}"),
                        }
                    }
                    Capability::Build => match authorize_builds(role.project_role()) {
                        Ok(()) => true,
                        Err(ApiError::PermissionDenied) => false,
                        other => panic!("{role:?}: {other:?}"),
                    },
                    Capability::Billing(operation) => {
                        let permission = match operation {
                            Operation::GetBilling => Permission::Read,
                            Operation::StartCheckout | Operation::OpenBillingPortal => {
                                Permission::Manage
                            }
                            _ => panic!("unexpected billing operation {operation:?}"),
                        };
                        match authorize(role, permission) {
                            Ok(()) => true,
                            Err(BillingError::Forbidden) => false,
                            other => panic!("{role:?} {capability:?}: {other:?}"),
                        }
                    }
                })
                .collect();
            assert!(
                outcomes.iter().all(|outcome| *outcome == outcomes[0]),
                "{role:?} {capability}: {outcomes:?}"
            );
            permissions.push(outcomes[0]);
        }
        executed.insert(capability, permissions);
    }
    assert_eq!(executed, documented_matrix());
}
