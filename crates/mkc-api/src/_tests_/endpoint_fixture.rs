//! Valid request bodies shared by registry construction and command execution tests.

use serde_json::{Value, json};

use crate::operation::Operation;

pub(crate) fn body(operation: Operation) -> Value {
    match operation {
        Operation::RequestBuild => json!({"branch":"main"}),
        Operation::SendMagicLink => json!({"email":"person@example.com"}),
        Operation::VerifyMagicLink => json!({"token":"fixture"}),
        Operation::VerifyPreviewSignIn => json!({"secret":"fixture"}),
        Operation::UpdateAccount | Operation::CreateToken => {
            json!({"name":"Name"})
        }
        Operation::CreateWorkspace => json!({"name":"Name", "slug":"name"}),
        Operation::UpdateWorkspace => json!({"name":"Name", "slug":"name", "version":1}),
        Operation::DeleteWorkspace => json!({"confirmationName":"Team", "version":1}),
        Operation::DeleteProject => json!({"confirmationName":"Project", "version":1}),
        Operation::InviteMember => json!({"email":"invited@example.com", "role":"member"}),
        Operation::UpdateMember | Operation::UpdateProjectGrant => {
            json!({"role":"member", "version":1})
        }
        Operation::RemoveMember | Operation::RemoveProjectGrant => json!({"version":1}),
        Operation::CreateProject => {
            json!({
                "name": "Name",
                "slug": "name",
                "repositoryId": "00000000-0000-0000-0000-000000000005",
                "configPath": "mokly.config.json",
            })
        }
        Operation::UpdateProject => {
            json!({"name":"Name", "slug":"name", "visibility":"private", "requireApproval":false, "version":1})
        }
        Operation::CreateProjectGrant => {
            json!({"userId":"00000000-0000-0000-0000-000000000015", "role":"member"})
        }
        _ => json!({}),
    }
}

pub(crate) fn query(operation: Operation) -> &'static str {
    match operation {
        Operation::SuggestWorkspaceSlug => "name=Name",
        Operation::SuggestProjectSlug => "repository=mokly-ai%2Fmokly&configPath=mokly.config.json",
        _ => "",
    }
}
