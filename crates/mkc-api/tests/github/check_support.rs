//! Real upload exchange, bounded delivery observations and a controllable integration clock.

use std::collections::BTreeMap;
use std::process::Command;
use std::sync::atomic::{AtomicI64, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use chrono::{DateTime, Utc};
use diesel::sql_types::{Bool, Integer, Text, Uuid as SqlUuid};
use diesel::{Connection, PgConnection, RunQueryDsl};
use mkc_auth::runtime::{Runtime, SystemRuntime};
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_store_interface::error::Result;
use mkc_store_interface::publication_event::EventKind;
use reqwest::Method;
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use super::harness::{Harness, json as response_json};

#[derive(Default)]
pub(super) struct CheckRuntime {
    pub(super) offset: AtomicI64,
}

impl Runtime for CheckRuntime {
    fn now(&self) -> DateTime<Utc> {
        Utc::now() + chrono::Duration::seconds(self.offset.load(Ordering::SeqCst))
    }
    fn monotonic(&self) -> Duration {
        SystemRuntime.monotonic()
    }
    fn id(&self) -> Uuid {
        Uuid::now_v7()
    }
    fn secret(&self) -> Result<String> {
        SystemRuntime.secret()
    }
}

/// One rerequest event of a publication, as its outbox row holds it.
#[derive(Clone, Debug, PartialEq, Eq, diesel::QueryableByName)]
pub(super) struct RerequestRow {
    #[diesel(sql_type = Integer)]
    pub(super) attempts: i32,
    #[diesel(sql_type = Integer)]
    pub(super) permanent_failures: i32,
    #[diesel(sql_type = Bool)]
    pub(super) delivered: bool,
}

#[derive(Deserialize)]
struct UploadFixture {
    plan: Vec<u8>,
    blobs: BTreeMap<String, Vec<u8>>,
}

impl Harness {
    pub(super) fn publish(&self, project: ProjectId, repository: &str, sha: &str) -> PublicationId {
        let token = response_json(
            self.request(Method::POST, &format!("/v1/projects/{project}/tokens"))
                .json(&json!({"name":"Check delivery smoke"}))
                .send()
                .unwrap(),
            201,
        );
        let secret = token["secret"].as_str().unwrap();
        let output = Command::new("python3")
            .arg(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/tests/github/upload_fixture.py"
            ))
            .args([repository, sha])
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let fixture: UploadFixture = serde_json::from_slice(&output.stdout).unwrap();
        let plan = response_json(
            self.request(
                Method::POST,
                &format!("/v1/projects/{project}/publications"),
            )
            .bearer_auth(secret)
            .header("Content-Type", "application/gzip")
            .body(fixture.plan)
            .send()
            .unwrap(),
            200,
        );
        for hash in plan["missing"].as_array().unwrap() {
            let hash = hash.as_str().unwrap();
            let url = plan["blobUrl"].as_str().unwrap().replace("{sha256}", hash);
            let path = url.strip_prefix(&self.origin).unwrap();
            let response = self
                .request(Method::PUT, path)
                .bearer_auth(secret)
                .header("Content-Type", "application/octet-stream")
                .body(fixture.blobs[hash].clone())
                .send()
                .unwrap();
            assert_eq!(response.status(), 204, "{}", response.text().unwrap());
        }
        let path = plan["completeUrl"]
            .as_str()
            .unwrap()
            .strip_prefix(&self.origin)
            .unwrap();
        let receipt = response_json(
            self.request(Method::POST, path)
                .bearer_auth(secret)
                .body(Vec::new())
                .send()
                .unwrap(),
            201,
        );
        assert_eq!(receipt["state"], "ready");
        receipt["id"]
            .as_str()
            .unwrap()
            .parse::<Uuid>()
            .unwrap()
            .into()
    }

    pub(super) fn wait_check(&self, publication: PublicationId, updates: usize) -> Value {
        wait_until(|| {
            let mode = self.github.mode.lock().unwrap();
            mode.check_updates >= updates
                && mode
                    .check_runs
                    .iter()
                    .any(|run| run["external_id"] == format!("mokly-publication:{publication}"))
        });
        self.github
            .mode
            .lock()
            .unwrap()
            .check_runs
            .iter()
            .find(|run| run["external_id"] == format!("mokly-publication:{publication}"))
            .unwrap()
            .clone()
    }

    /// Every rerequest event of one publication, oldest first, delivered ones
    /// included. The store reads only due events, so this reads the rows.
    pub(super) fn rerequest_events(&self, publication: PublicationId) -> Vec<RerequestRow> {
        diesel::sql_query(
            "SELECT attempts, permanent_failures, delivered_at IS NOT NULL AS delivered
            FROM publication_events WHERE publication_id = $1 AND kind = $2
            ORDER BY created_at, id",
        )
        .bind::<SqlUuid, _>(publication.0)
        .bind::<Text, _>(EventKind::Rerequest.as_str())
        .load(&mut PgConnection::establish(self._schema.scoped_url()).unwrap())
        .unwrap()
    }

    pub(super) fn check_events_are_delivered(&self, publication: PublicationId) -> bool {
        let mut done = false;
        self.queries(&mut |queries| {
            let value = queries.publication(publication)?.unwrap();
            done = queries
                .pending_publication_events(
                    Utc::now() + chrono::Duration::days(1),
                    100,
                    Some(value.project_id),
                )?
                .iter()
                .all(|pending| pending.event.publication_id != publication);
            Ok(())
        });
        done
    }
}

pub(super) fn wait_until(mut condition: impl FnMut() -> bool) {
    let deadline = Instant::now() + Duration::from_secs(20);
    while !condition() {
        assert!(Instant::now() < deadline, "check delivery did not finish");
        thread::sleep(Duration::from_millis(25));
    }
}
