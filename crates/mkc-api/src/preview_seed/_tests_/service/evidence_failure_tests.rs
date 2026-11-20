//! A failed revocation or proof write cannot mark the project seeded.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::{Arc, Mutex};

use mkc_auth::runtime::RuntimeMock;
use mkc_auth::service::AuthenticatorMock;
use mkc_file_store_interface::error;
use mkc_file_store_interface::seed::SeedStoreMock;
use serde_json::{Value, json};
use unimock::{MockFn, Unimock, matching};

use crate::action::Action;
use crate::payload::Reply;
use crate::platform::error::Error;
use crate::platform::service::ExecutePlatformMock;
use crate::preview_seed::catalogue::SeedCatalogueMock;
use crate::preview_seed::service::{PreviewSeeder, SeedService};
use crate::preview_seed::upload::CatalogueUploadMock;

use super::fixtures::{HEAD, locations, now, project, publication, token, user, workspace};

#[test]
fn revocation_or_proof_failure_keeps_failed_status_and_returns_failure() {
    for revoke_fails in [true, false] {
        let events = Arc::new(Mutex::new(Vec::new()));
        let recorded = events.clone();
        let revoked = events.clone();
        let request = serde_json::to_vec(&json!({ "schemaVersion": 1,
            "environment": "local", "revision": HEAD, "pullRequest": null }))
        .unwrap();
        let files = Unimock::new((
            SeedStoreMock::get
                .some_call(matching!((name, _) if name.as_str() == "seed/run/request.json"))
                .returns(Ok(Some(request))),
            SeedStoreMock::put
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, name, bytes| {
                    let value: Value = serde_json::from_slice(&bytes).unwrap();
                    let mut events = recorded.lock().unwrap();
                    if name.as_str() == "seed/run/seed-proof.json" {
                        events.push("proof".to_owned());
                        return Err(error::Error::internal_message("test proof failure"));
                    }
                    assert_eq!(name.as_str(), "seed/run/seed-status.json");
                    events.push(format!(
                        "status:{}:{}",
                        value["project"].as_str().unwrap(),
                        value["signIn"].as_str().unwrap()
                    ));
                    Ok(())
                })),
        ));
        let platform = Unimock::new((
            ExecutePlatformMock
                .some_call(matching!(Some(_), Action::WorkspaceBySlug(_), _))
                .returns(Ok(workspace())),
            ExecutePlatformMock
                .some_call(matching!(Some(_), Action::ProjectBySlug(_, _), _))
                .returns(Ok(project())),
            ExecutePlatformMock
                .some_call(matching!(Some(_), Action::CreateToken(_, _), _))
                .returns(Ok(token())),
            ExecutePlatformMock
                .some_call(matching!(Some(_), Action::RevokeToken(_, _), _))
                .answers_arc(Arc::new(move |_, _, _, _| {
                    revoked.lock().unwrap().push("revoke".to_owned());
                    if revoke_fails {
                        Err(Error::Unavailable)
                    } else {
                        Ok(Reply::empty())
                    }
                })),
        ));
        let seed = SeedService {
            auth: Arc::new(Unimock::new((
                AuthenticatorMock::preview_sign_in_available
                    .some_call(matching!())
                    .returns(true),
                AuthenticatorMock::preview_account
                    .some_call(matching!())
                    .returns(Ok(user())),
            ))),
            platform: Arc::new(platform),
            files: Arc::new(files),
            catalogue: Arc::new(Unimock::new(
                SeedCatalogueMock::read
                    .some_call(matching!((run, revision) if *run == "run" && *revision == HEAD))
                    .returns(Ok(vec![])),
            )),
            uploader: Arc::new(Unimock::new(
                CatalogueUploadMock::publish
                    .some_call(matching!(_, _, _, _))
                    .returns(Ok(publication())),
            )),
            runtime: Arc::new(Unimock::new(
                RuntimeMock::now.each_call(matching!()).returns(now()),
            )),
            locations: locations(),
            revision: "development",
        };
        let result = seed.run("run");
        assert!(result.is_err());
        let recorded = events.lock().unwrap();
        let expected = if revoke_fails {
            vec!["status:failed:refused", "revoke", "status:failed:accepted"]
        } else {
            vec![
                "status:failed:refused",
                "revoke",
                "proof",
                "status:failed:accepted",
            ]
        };
        assert_eq!(*recorded, expected);
    }
}
