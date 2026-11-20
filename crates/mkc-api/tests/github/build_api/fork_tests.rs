//! Stored fork facts stay visible across roles, plans and build availability.

use mkc_domain::values::{Plan, Role};
use mkc_store_interface::github_state::DeliveryStatus;
use serde_json::json;

use super::super::build_provider::RunMode;
use super::super::harness::Harness;
use super::support::{read, role};

#[test]
fn pull_request_rows_report_forks_for_every_authorized_reader() {
    for configured in [false, true] {
        let Some(mut app) = (if configured {
            Harness::start_with_build_mode(RunMode::Wait)
        } else {
            Harness::start()
        }) else {
            return;
        };
        app.sign_in();
        let project = app.install_project();
        app.send("pull_request", "pull_request", DeliveryStatus::Done);
        for available in [true, false] {
            for plan in [Plan::Free, Plan::Team] {
                for (head, base, fork) in [
                    (Some(true), Some(true), false),
                    (Some(false), Some(true), true),
                    (None, Some(true), true),
                    (Some(true), Some(false), true),
                    (Some(true), None, true),
                ] {
                    app.queries(&mut |q| {
                        let mut repository =
                            q.github_repository(project.repository).unwrap().unwrap();
                        repository.active = available;
                        q.save_github_repository(&repository).unwrap();
                        let mut pull = q.github_pull_requests(repository.id).unwrap().remove(0);
                        pull.head_repository_id =
                            head.map(|same| repository.github_id + i64::from(!same));
                        pull.base_repository_id =
                            base.map(|same| repository.github_id + i64::from(!same));
                        pull.open = false;
                        q.save_github_pull_request(&pull).unwrap();
                        let workspace = q.project(project.id).unwrap().unwrap().organization_id;
                        let mut workspace = q.organization(workspace).unwrap().unwrap();
                        workspace.plan = plan;
                        q.save_organization(&workspace).unwrap();
                    });
                    for direct in [false, true] {
                        for member in [Role::Owner, Role::Admin, Role::Member, Role::Reviewer] {
                            if direct && member == Role::Owner {
                                continue;
                            }
                            role(&app, project.id, Some(member), direct);
                            assert_eq!(
                                read(&app, project.id, "pull-requests")["items"][0]["fork"],
                                json!(fork)
                            );
                        }
                    }
                    role(&app, project.id, None, false);
                    for anonymous in [false, true] {
                        let cookie = app.cookie.clone();
                        if anonymous {
                            app.cookie.clear();
                        }
                        assert_eq!(
                            read(&app, project.id, "pull-requests")["items"][0]["fork"],
                            json!(fork)
                        );
                        app.cookie = cookie;
                    }
                }
            }
        }
    }
}
