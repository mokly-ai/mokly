//! Workspace creation applies the preview plan to the transactional creator only.

use std::sync::Arc;

use mkc_domain::values::Plan;
use mkc_store_interface::member::MembersMock;
use mkc_store_interface::organization::OrganizationsMock;
use mkc_store_interface::user::UsersMock;
use unimock::{MockFn, Unimock, matching};

use crate::action::Action;
use crate::input::CreateWorkspace;
use crate::payload::Payload;
use crate::platform::execution::Command;
use crate::platform::initial_plan::PreviewWorkspacePlan;

use super::support::{USER, execution, user};

#[test]
fn initial_plan_uses_the_creator_read_in_the_creation_transaction() {
    for (configured, email, expected) in [
        (None, "preview@example.com", Plan::Free),
        (Some(Plan::Free), "preview@example.com", Plan::Free),
        (Some(Plan::Team), "preview@example.com", Plan::Team),
        (Some(Plan::Team), "another@example.com", Plan::Free),
    ] {
        let preview = configured.map(|plan| PreviewWorkspacePlan {
            email: "preview@example.com".into(),
            plan,
        });
        let mut creator = user();
        creator.email = email.into();
        let mut queries = Unimock::new((
            UsersMock::user
                .next_call(matching!(&USER))
                .returns(Ok(Some(creator))),
            OrganizationsMock::insert_organization
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, workspace| {
                    assert_eq!(workspace.plan, expected);
                    Ok(())
                })),
            MembersMock::insert_member
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, member| {
                    assert_eq!(member.user_id, Some(USER));
                    assert_eq!(member.email, email);
                    Ok(())
                })),
        ));
        let action = Action::CreateWorkspace(CreateWorkspace {
            name: "Preview".into(),
            slug: "preview-team".parse().unwrap(),
        });
        let mut execution = execution(&action);
        execution.preview_workspace = preview.as_ref();
        let reply = execution.execute(&mut queries).unwrap();
        let Payload::Workspace(workspace) = reply.payload else {
            panic!("workspace response");
        };
        assert_eq!(workspace.plan, expected);
    }
}
