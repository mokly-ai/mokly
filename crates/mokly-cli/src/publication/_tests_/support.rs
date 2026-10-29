//! Frozen model output used by CLI adapter tests.

use mokly_git::command::CancellationMock;
use unimock::{MockFn, Unimock, matching};

use std::path::PathBuf;

use mokly_model::output::artifact::{Artifact, File};
use mokly_model::output::repository::Repository;
use mokly_model::output::upload::{BuildInventory, Comparison, Publication};
use mokly_model::output::validation::INDEX;
use mokly_publish::redaction::Secret;
use mokly_publish::settings::Settings;
use serde_json::json;

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
            json!({"schemaVersion":8,"base":comparison.base_ref,"baseCommit":comparison.base_sha})
        }
        None => json!({"schemaVersion":8}),
    };
    files.push(file(INDEX, &serde_json::to_vec(&index).unwrap()));
    Artifact::finalize(
        PathBuf::from("/private/publish/site"),
        files,
        Some(publication().metadata(&inventory).unwrap()),
    )
    .unwrap()
}

pub(super) fn file(path: &str, bytes: &[u8]) -> File {
    File {
        path: path.to_owned(),
        bytes: bytes.to_vec().into(),
    }
}

pub(super) fn settings(concurrency: u8) -> Settings {
    Settings::new(
        "https://api.example.com/plan?x=1",
        Secret::new("secret/a=="),
        concurrency,
    )
    .unwrap()
}

pub(super) fn active() -> Unimock {
    Unimock::new(
        CancellationMock::is_cancelled
            .each_call(matching!())
            .returns(false),
    )
}
