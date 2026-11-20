//! Every viewer query executes the same project visibility matrix as getProject.

use mkc_domain::ids::UserId;
use mkc_domain::values::{Role, Visibility};
use mkc_store_interface::grant::{Grant, GrantsMock};
use mkc_store_interface::member::{Member, MembersMock};
use mkc_store_interface::organization::OrganizationsMock;
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::viewer::ViewerReadsMock;
use serde_json::{Value, json};
use unimock::{Clause, MockFn, Unimock, matching};
use uuid::Uuid;

use crate::platform::error::Error;
use crate::platform::project_access::ProjectReader;
use crate::viewer::input::{Action, Query, Read};
use crate::viewer::projection;
use crate::viewer::snapshot::{ReadSnapshot, Rows, SnapshotReader};

use super::policy_data;
use super::support::{PROJECT, PUBLICATION, USER, WORKSPACE, locations, now, project, workspace};

#[test]
fn all_six_reads_apply_every_role_anonymous_and_direct_grant_policy() {
    for visibility in [Visibility::Private, Visibility::Public] {
        for (role, direct, anonymous, pending) in [
            (Some(Role::Owner), None, false, false),
            (Some(Role::Admin), None, false, false),
            (Some(Role::Member), None, false, false),
            (Some(Role::Reviewer), None, false, false),
            (None, Some(Role::Admin), false, false),
            (None, Some(Role::Member), false, false),
            (None, Some(Role::Reviewer), false, false),
            (None, None, false, false),
            (None, None, true, false),
            (Some(Role::Reviewer), None, false, true),
        ] {
            for read in [
                Read::Branches,
                Read::PullRequests,
                Read::History,
                Read::Publication(PUBLICATION),
                Read::Screens(PUBLICATION),
                Read::Share(PUBLICATION),
            ] {
                let allowed = visibility == Visibility::Public
                    || (!pending && role.is_some())
                    || direct.is_some();
                let project = ProjectsMock::project
                    .next_call(matching!((id) if *id == PROJECT))
                    .returns(Ok(Some(project(visibility))));
                if anonymous {
                    assert_case(project, allowed, read, None);
                } else {
                    let policy = (
                        project,
                        MembersMock::members
                            .next_call(matching!((id) if *id == WORKSPACE))
                            .returns(Ok(role
                                .map(|role| Member {
                                    id: Uuid::from_u128(7).into(),
                                    organization_id: WORKSPACE,
                                    user_id: if pending { None } else { Some(USER) },
                                    email: "reader@example.com".into(),
                                    role,
                                    version: 1,
                                    expires_at: None,
                                })
                                .into_iter()
                                .collect())),
                        GrantsMock::grants
                            .next_call(matching!((id) if *id == PROJECT))
                            .returns(Ok(direct
                                .map(|role| Grant {
                                    id: Uuid::from_u128(8).into(),
                                    project_id: PROJECT,
                                    user_id: USER,
                                    role,
                                    version: 1,
                                })
                                .into_iter()
                                .collect())),
                    );
                    assert_case(policy, allowed, read, Some(USER));
                }
            }
        }
    }
}

fn assert_case(policy: impl Clause, allowed: bool, read: Read, actor: Option<UserId>) {
    let mut queries = if allowed {
        match read {
        Read::Branches => Unimock::new((policy, workspace_query(), ViewerReadsMock::viewer_branches.next_call(matching!((id, None, 51) if *id == PROJECT)).returns(Ok(vec![policy_data::branch()])))),
        Read::PullRequests => Unimock::new((policy, workspace_query(), ViewerReadsMock::viewer_pull_requests.next_call(matching!((id, None, 51) if *id == PROJECT)).returns(Ok(vec![policy_data::pull_request()])))),
        Read::History => Unimock::new((policy, workspace_query(), ViewerReadsMock::viewer_publications.next_call(matching!((id, _, None, 51) if *id == PROJECT)).returns(Ok(vec![policy_data::publication()])))),
        _ => Unimock::new((policy, workspace_query(), ViewerReadsMock::viewer_publication.next_call(matching!((id, publication) if *id == PROJECT && *publication == PUBLICATION)).returns(Ok(Some(policy_data::publication()))))),
    }
    } else {
        Unimock::new(policy)
    };
    let action = Action {
        project: PROJECT,
        read,
    };
    let query = Query::parse(action, "").unwrap();
    let access = ProjectReader { actor };
    let reader: &dyn ReadSnapshot = &SnapshotReader {
        access: &access,
        action,
        query: &query,
    };
    let result = reader.read(&mut queries);
    if allowed {
        let value = response(result.unwrap().rows);
        if matches!(read, Read::Branches | Read::PullRequests) {
            assert_eq!(
                value["newestPublication"],
                json!({
                    "id": PUBLICATION,
                    "state": "ready",
                    "publishedAt": now(),
                    "buildId": null, "headSha": "a".repeat(40),
                }),
                "{read:?}"
            );
        } else {
            assert_eq!(
                value["pullRequest"],
                json!({
                    "number": 7,
                    "title": "Publication origin",
                    "author": "octocat",
                    "url": "https://github.com/mokly-ai/mokly-cloud/pull/7",
                }),
                "{read:?}"
            );
        }
    } else {
        assert!(matches!(result, Err(Error::NotFound)));
    }
}

fn workspace_query() -> impl Clause {
    OrganizationsMock::organization
        .next_call(matching!(_))
        .returns(Ok(Some(workspace())))
}

fn response(rows: Rows) -> Value {
    match rows {
        Rows::Branches(mut rows) => serde_json::to_value(projection::branch(rows.remove(0))),
        Rows::PullRequests(mut rows) => {
            serde_json::to_value(projection::pull_request(rows.remove(0)))
        }
        Rows::History(rows) => {
            serde_json::to_value(projection::publication(&rows[0], &locations()))
        }
        Rows::Publication(row) => {
            serde_json::to_value(projection::publication(&row.context, &locations()))
        }
    }
    .unwrap()
}
