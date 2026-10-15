//! Frozen model output used by CLI adapter tests.

use std::path::PathBuf;

use mokly_model::output::artifact::{Artifact, File};
use mokly_model::output::repository::Repository;
use mokly_model::output::upload::{BuildInventory, Comparison, Publication};
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
            path: format!(
                "mokly-viewer/diffs/generations/{}/review.json",
                "c".repeat(64)
            ),
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
    if let Some(comparison) = &inventory.comparison {
        files.push(file(&comparison.path, &serde_json::to_vec(&json!({"schemaVersion":8,"baseRef":comparison.base_ref,"baseCommit":comparison.base_sha})).unwrap()));
    }
    Artifact::finalize(
        PathBuf::from("/private/publish"),
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
        "secret/a==".to_owned(),
        concurrency,
    )
    .unwrap()
}
