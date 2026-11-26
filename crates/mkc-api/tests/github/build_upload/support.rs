//! Mint attempt grants through real queries and drive the public upload routes.

use std::collections::BTreeMap;
use std::process::Command;

use chrono::{Duration, Utc};
use mkc_domain::ids::{BuildId, ProjectId, PublicationId};
use mkc_domain::values::Visibility;
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_attempt::BuildAttempt;
use mkc_store_interface::build_grant::BuildUploadGrant;
use mkc_store_interface::build_state::{BuildTrigger, UploadOutcome};
use reqwest::Method;
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::contract_client::ContractResponse;

use super::super::harness::{Harness, json};
use super::super::workflow::Project;

pub(super) struct Attempt {
    pub(super) id: BuildId,
    pub(super) bearer: String,
    pub(super) grant: Uuid,
    pub(super) head: String,
    pub(super) branch: String,
    pub(super) project: ProjectId,
}

#[derive(Deserialize)]
pub(super) struct Catalogue {
    pub(super) plan: Vec<u8>,
    pub(super) blobs: BTreeMap<String, Vec<u8>>,
}

pub(super) fn start(
    app: &Harness,
    project: &Project,
    index: usize,
    age: Duration,
    pull: Option<i64>,
) -> Attempt {
    let at = Utc::now() - age;
    let id = Uuid::now_v7().into();
    let head = format!("{index:040x}");
    let branch = format!("build-{index}");
    let bearer = format!("mkb_{}{}", Uuid::now_v7().simple(), Uuid::now_v7().simple());
    let grant = Uuid::now_v7();
    app.queries(&mut |queries| {
        let mut value = queries.project(project.id)?.unwrap();
        value.visibility = Visibility::Public;
        queries.save_project(&value)?;
        queries.schedule_build(&NewBuild {
            id,
            project_id: project.id,
            repository_id: project.repository,
            trigger: BuildTrigger::Request,
            branch: branch.clone(),
            head_sha: head.clone(),
            pull_request: pull,
            base_ref: None,
            config_path: value.config_path,
            created_at: at,
        })?;
        let started = queries
            .start_build(
                id,
                &BuildAttempt {
                    now: at,
                    operation_id: Uuid::now_v7(),
                    lease_token: Uuid::now_v7(),
                    lease_expires_at: at + Duration::minutes(2),
                    deadline_at: at + Duration::minutes(15),
                },
            )?
            .unwrap();
        assert!(queries.mint_build_grant(&BuildUploadGrant {
            id: grant,
            build_id: id,
            attempt: started.attempt,
            token_digest: Sha256::digest(bearer.as_bytes()).into(),
            expires_at: started.deadline_at.unwrap(),
            consumed_at: None,
            outcome: None,
            created_at: at,
        })?);
        Ok(())
    });
    Attempt {
        id,
        bearer,
        grant,
        head,
        branch,
        project: project.id,
    }
}

pub(super) fn catalogue(attempt: &Attempt, pull: Option<i64>) -> Catalogue {
    catalogue_with(attempt, pull, "{}")
}

pub(super) fn catalogue_with(attempt: &Attempt, pull: Option<i64>, patch: &str) -> Catalogue {
    let output = Command::new("python3")
        .arg(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/github/upload_fixture.py"
        ))
        .args([
            "octocat/hello-world",
            &attempt.head,
            &attempt.branch,
            "mokly.config.json",
            &pull.map_or("null".into(), |number| number.to_string()),
        ])
        .arg(patch)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_slice(&output.stdout).unwrap()
}

pub(super) fn plan(app: &Harness, attempt: &Attempt, bytes: Vec<u8>) -> ContractResponse {
    app.request(
        Method::POST,
        &format!("/v1/projects/{}/publications", attempt.project),
    )
    .bearer_auth(&attempt.bearer)
    .header("Content-Type", "application/gzip")
    .body(bytes)
    .send()
    .unwrap()
}

pub(super) fn complete(
    app: &Harness,
    attempt: &Attempt,
    upload: PublicationId,
) -> ContractResponse {
    app.request(
        Method::POST,
        &format!(
            "/v1/projects/{}/publication-uploads/{upload}/complete",
            attempt.project
        ),
    )
    .bearer_auth(&attempt.bearer)
    .body(Vec::new())
    .send()
    .unwrap()
}

pub(super) fn blob(
    app: &Harness,
    attempt: &Attempt,
    upload: PublicationId,
    hash: &str,
    bytes: Vec<u8>,
) -> ContractResponse {
    app.request(
        Method::PUT,
        &format!(
            "/v1/projects/{}/publication-uploads/{upload}/blobs/{hash}",
            attempt.project
        ),
    )
    .bearer_auth(&attempt.bearer)
    .header("Content-Type", "application/octet-stream")
    .body(bytes)
    .send()
    .unwrap()
}

pub(super) fn upload_id(planned: &Value) -> PublicationId {
    planned["upload"]["id"]
        .as_str()
        .unwrap()
        .parse::<Uuid>()
        .unwrap()
        .into()
}

pub(super) fn send_blobs(app: &Harness, attempt: &Attempt, planned: &Value, catalogue: &Catalogue) {
    let id = upload_id(planned);
    for hash in planned["missing"].as_array().unwrap() {
        let hash = hash.as_str().unwrap();
        let response = blob(app, attempt, id, hash, catalogue.blobs[hash].clone());
        assert_eq!(response.status(), 204, "{}", response.text().unwrap());
    }
}

pub(super) fn outcome(app: &Harness, attempt: &Attempt) -> Option<UploadOutcome> {
    let mut result = None;
    app.queries(&mut |queries| {
        result = queries
            .build_grant(&Sha256::digest(attempt.bearer.as_bytes()).into())?
            .unwrap()
            .outcome;
        Ok(())
    });
    result
}

pub(super) fn refusal(response: ContractResponse, status: u16, reason: &str, bearer: &str) {
    let value = json(response, status);
    assert_eq!(value["error"]["reason"], reason);
    assert!(!value.to_string().contains(bearer));
}
