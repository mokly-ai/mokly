//! API fields come from typed persistence records and optional integrations.

use mkc_domain::values::{Plan, Role, Visibility};
use mkc_store_interface::integration::Integration;

use crate::platform::projection;

use super::support::{project, user, workspace};

#[test]
fn optional_integrations_determine_github_fields() {
    for account in [None, Some("mokly-ai".to_owned())] {
        let integration = account.clone().map(|account| Integration { account });
        assert_eq!(
            projection::user(user(), integration.clone()).github_connected,
            account.is_some()
        );
    }
}

#[test]
fn approval_projection_reads_the_stored_policy() {
    let workspace = workspace();
    for required in [true, false] {
        let mut stored = project();
        stored.require_approval = required;
        assert_eq!(
            projection::project(stored, &workspace, Some(Role::Admin), false).require_approval,
            required
        );
    }
}

#[test]
fn project_projection_exposes_only_the_current_project_publishing_capability() {
    for (visibility, plan, role, allowed) in [
        (Visibility::Public, Plan::Free, None, true),
        (Visibility::Public, Plan::Team, None, true),
        (Visibility::Private, Plan::Free, Some(Role::Admin), false),
        (Visibility::Private, Plan::Team, Some(Role::Admin), true),
    ] {
        let mut workspace = workspace();
        workspace.plan = plan;
        let mut project = project();
        project.visibility = visibility;
        let view = projection::project(project, &workspace, role, false);
        assert_eq!(view.publishing_allowed, allowed);
    }
}
