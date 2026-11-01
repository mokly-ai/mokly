//! Small immutable catalogue and protocol response factories.

use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::Arc;

use bytes::Bytes;
use mokly_git::command::CancellationMock;
use mokly_model::output::artifact::{Artifact, File};
use mokly_model::output::repository::Repository;
use mokly_model::output::upload::{BuildInventory, Comparison, Publication};
use mokly_model::output::validation::{INDEX, MANIFEST, MARKER, digest};
use serde_json::{Value, json};
use unimock::{MockFn, Unimock, matching};

use crate::exchange::Client;
use crate::http::{Body, Response};
use crate::runtime::{self, ClockMock, ReporterMock};
use crate::settings::Settings;
use crate::snapshot::Prepared;

pub(super) fn publication() -> Publication {
    Publication {
        mokly_version: "0.14.0-beta.1+test".to_owned(),
        repository: Repository::parse("example.com/group/project").unwrap(),
        branch: "feature".to_owned(),
        head_sha: "a".repeat(40),
        pull_request: None,
    }
}

pub(super) fn inventory(comparison: bool) -> BuildInventory {
    BuildInventory {
        config_path: "tools/mokly.config.json".to_owned(),
        exported_at: "2026-09-26T12:00:00.000Z".to_owned(),
        comparison: comparison.then(|| Comparison {
            base_ref: "origin/main".to_owned(),
            base_sha: "b".repeat(40),
        }),
    }
}

pub(super) fn artifact(comparison: bool) -> Artifact {
    let inventory = inventory(comparison);
    let mut files = vec![
        file("index.html", b"shell"),
        file("404.html", b"shell"),
        file("static/one.txt", b"one"),
        file("static/same.txt", b"one"),
        file("static/two.txt", b"two"),
    ];
    let index = match &inventory.comparison {
        Some(comparison) => {
            json!({"schemaVersion":9,"base":comparison.base_ref,"baseCommit":comparison.base_sha,"changesStatus":"ready"})
        }
        None => json!({"schemaVersion":9,"base":"origin/main","changesStatus":"unavailable"}),
    };
    files.push(file(INDEX, &serde_json::to_vec(&index).unwrap()));
    Artifact::finalize(
        PathBuf::from("/private/publish"),
        files,
        Some(publication().metadata(&inventory).unwrap()),
    )
    .unwrap()
}

pub(super) fn prepared_with_file(path: &str, bytes: Bytes) -> Prepared {
    let base = artifact(false);
    let files = base
        .files
        .into_iter()
        .filter(|file| file.path != MANIFEST && file.path != MARKER)
        .chain(std::iter::once(file(path, &bytes)))
        .collect();
    let artifact = Artifact::finalize(
        base.directory,
        files,
        Some(publication().metadata(&inventory(false)).unwrap()),
    )
    .unwrap();
    Prepared::new(&artifact).unwrap()
}

pub(super) fn file(path: &str, bytes: &[u8]) -> File {
    File {
        path: path.to_owned(),
        bytes: Bytes::copy_from_slice(bytes),
    }
}

pub(super) fn settings(concurrency: u8) -> Settings {
    Settings::new(
        "https://api.example.com/plan?x=1",
        "secret/a==".to_owned(),
        concurrency,
    )
    .unwrap()
}

pub(super) fn response(status: u16) -> Response {
    Response {
        status,
        content_type: Some("application/json".to_owned()),
        retry_after: None,
        body: Body::Bytes(Bytes::new()),
    }
}

pub(super) fn plan(missing: BTreeSet<String>) -> Response {
    plan_with_encoding(missing, None)
}

pub(super) fn plan_with_encoding(missing: BTreeSet<String>, encodings: Option<Value>) -> Response {
    let mut body = json!({ "schemaVersion":1, "upload":{"id":"upload-1","expiresAt":"2026-09-26T13:00:00.000Z"},
        "missing": missing, "blobUrl":"https://api.example.com/blobs/{sha256}", "completeUrl":"https://api.example.com/complete" });
    if let Some(encodings) = encodings {
        body["blobEncodings"] = encodings;
    }
    Response {
        body: Body::Bytes(serde_json::to_vec(&body).unwrap().into()),
        ..response(200)
    }
}

pub(super) fn digest_for(prepared: &Prepared, path: &str) -> String {
    prepared
        .ownership
        .files
        .iter()
        .find(|entry| entry.path == path)
        .unwrap()
        .sha256
        .clone()
}

pub(super) fn seeded_bytes(length: usize) -> Bytes {
    let mut value = 0x1234_5678_u32;
    let mut bytes = Vec::with_capacity(length);
    while bytes.len() < length {
        value ^= value << 13;
        value ^= value >> 17;
        value ^= value << 5;
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    bytes.truncate(length);
    bytes.into()
}

pub(super) fn client(http: Unimock, reporter: Arc<Unimock>, clock: Arc<Unimock>) -> Client {
    Client {
        http: Arc::new(http),
        clock,
        reporter,
    }
}

pub(super) fn missing() -> BTreeSet<String> {
    [digest(b"one"), digest(b"two"), digest(b"shell")].into()
}

pub(super) fn active() -> Unimock {
    Unimock::new((
        CancellationMock::is_cancelled
            .each_call(matching!())
            .returns(false),
        runtime::CancellationMock::cancelled
            .each_call(matching!())
            .answers(&|_| Box::pin(std::future::pending())),
    ))
}

pub(super) fn clock() -> Arc<Unimock> {
    Arc::new(Unimock::new(
        ClockMock::now
            .each_call(matching!())
            .returns(1_790_424_000_000_i64),
    ))
}

pub(super) fn reporter() -> Arc<Unimock> {
    Arc::new(Unimock::new(
        ReporterMock::progress.each_call(matching!(_)).returns(()),
    ))
}
