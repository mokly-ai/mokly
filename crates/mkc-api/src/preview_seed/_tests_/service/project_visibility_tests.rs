//! Seeded sample projects become public without updating an existing public project.

use mkc_domain::ids::{ProjectId, UserId};
use mkc_domain::values::Visibility;
use mkc_file_store_interface::seed::SeedStoreMock;
use serde_json::{Value, json};
use unimock::{Clause, MockFn, Unimock, matching};
use uuid::Uuid;

use crate::action::Action;
use crate::payload::{Payload, Reply};
use crate::platform::error::Error;
use crate::platform::service::ExecutePlatformMock;
use crate::preview_seed::service::PreviewSeeder;
use crate::views::projects::{ProjectSlugLookupView, ProjectView};

use super::fixtures::{HEAD, project_view, service, token, workspace};

#[test]
fn created_private_project_becomes_public_and_writes_proof() {
    let platform = Unimock::new((
        common_platform(),
        ExecutePlatformMock
            .some_call(matching!(Some(_), Action::ProjectBySlug(_, _), _))
            .returns(Err(Error::NotFound)),
        ExecutePlatformMock
            .some_call(matching!(Some(_), Action::CreateProject(_, _), _))
            .returns(Ok(Reply::created(Payload::Project(stored_project(
                Visibility::Private,
            ))))),
        public_update(),
    ));
    assert_seeded(platform);
}

#[test]
fn found_private_project_becomes_public_and_writes_proof() {
    let platform = Unimock::new((
        common_platform(),
        ExecutePlatformMock
            .some_call(matching!(Some(_), Action::ProjectBySlug(_, _), _))
            .returns(Ok(lookup(Visibility::Private))),
        public_update(),
    ));
    assert_seeded(platform);
}

#[test]
fn found_public_project_gets_no_update_and_writes_proof() {
    let platform = Unimock::new((
        common_platform(),
        ExecutePlatformMock
            .some_call(matching!(Some(_), Action::ProjectBySlug(_, _), _))
            .returns(Ok(lookup(Visibility::Public))),
    ));
    assert_seeded(platform);
}

fn stored_project(visibility: Visibility) -> ProjectView {
    let mut project = project_view();
    project.visibility = visibility;
    project.version = 7;
    project
}

fn lookup(visibility: Visibility) -> Reply {
    Reply::ok(Payload::ProjectSlugLookup(ProjectSlugLookupView {
        project: stored_project(visibility),
        canonical_slug: "mokly".parse().unwrap(),
        canonical_workspace_slug: "mokly-ai".parse().unwrap(),
    }))
}

fn common_platform() -> impl Clause {
    (
        ExecutePlatformMock
            .some_call(matching!(Some(_), Action::WorkspaceBySlug(_), _))
            .returns(Ok(workspace())),
        ExecutePlatformMock
            .some_call(matching!(Some(_), Action::CreateToken(_, _), _))
            .returns(Ok(token())),
        ExecutePlatformMock
            .some_call(matching!(Some(_), Action::RevokeToken(_, _), _))
            .returns(Ok(Reply::empty())),
    )
}

fn public_update() -> impl Clause {
    ExecutePlatformMock
        .some_call(matching!(Some(_), Action::UpdateProject(_, _), _))
        .answers(&|_, actor, action, _| {
            let Action::UpdateProject(id, input) = action else {
                panic!("expected project update");
            };
            assert_eq!(actor, Some(UserId(Uuid::from_u128(1))));
            assert_eq!(id, ProjectId(Uuid::from_u128(3)));
            assert_eq!(input.visibility, Visibility::Public);
            assert_eq!(input.name, "Mokly Cloud");
            assert_eq!(input.slug.as_str(), "mokly");
            assert_eq!(input.version, 7);
            assert!(!input.require_approval);
            assert_eq!(input.automatic_builds, None);
            let mut updated = stored_project(Visibility::Public);
            updated.version = 8;
            Ok(Reply::ok(Payload::Project(updated)))
        })
        .once()
}

fn assert_seeded(platform: Unimock) {
    let request = serde_json::to_vec(&json!({ "schemaVersion": 1,
        "environment": "local", "revision": HEAD, "pullRequest": null }))
    .unwrap();
    let files = Unimock::new((
        SeedStoreMock::get
            .some_call(matching!((name, _) if name.as_str() == "seed/run/request.json"))
            .returns(Ok(Some(request))),
        SeedStoreMock::put
            .each_call(matching!((name, _) if name.as_str() == "seed/run/seed-status.json"))
            .answers(&|_, _, _| Ok(())),
        SeedStoreMock::put
            .some_call(matching!((name, _) if name.as_str() == "seed/run/seed-proof.json"))
            .answers(&|_, _, bytes| {
                let proof: Value = serde_json::from_slice(&bytes).unwrap();
                assert_eq!(proof["projectId"], "00000000-0000-0000-0000-000000000003");
                assert_eq!(proof["publicationState"], "ready");
                Ok(())
            })
            .once(),
    ));
    let seed = service(platform, files);
    let result = seed.run("run");
    assert!(result.is_ok(), "seed failed: {result:?}");
}
