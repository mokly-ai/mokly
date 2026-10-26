//! Receiver fixture independent of source discovery or the static renderer.

use std::collections::BTreeMap;
use std::io::Read;
use std::path::PathBuf;

use flate2::read::GzDecoder;
use mokly_model::output::artifact::{Artifact, File};
use mokly_model::output::repository::Repository;
use mokly_model::output::upload::{BuildInventory, Comparison, Publication};
use mokly_model::output::validation::{INDEX, MANIFEST, MARKER, digest};
use serde_json::Value;

pub fn artifact(directory: PathBuf, comparison: bool) -> Artifact {
    let publication = Publication {
        mokly_version: "0.14.0".to_owned(),
        repository: Repository::parse("example.com/team/project").unwrap(),
        branch: "feature".to_owned(),
        head_sha: "a".repeat(40),
        pull_request: Some(23),
    };
    let comparison = comparison.then(|| Comparison {
        base_ref: "origin/main".to_owned(),
        base_sha: "b".repeat(40),
    });
    let mut files = vec![
        File {
            path: "index.html".to_owned(),
            bytes: b"shell".as_slice().into(),
        },
        File {
            path: "404.html".to_owned(),
            bytes: b"shell".as_slice().into(),
        },
        File {
            path: "static/shared.txt".to_owned(),
            bytes: b"\0\xff\x80shared".as_slice().into(),
        },
        File {
            path: "static/alias.txt".to_owned(),
            bytes: b"\0\xff\x80shared".as_slice().into(),
        },
    ];
    files.push(File {
        path: INDEX.to_owned(),
        bytes: match &comparison {
            Some(comparison) => format!(
                "{{\"schemaVersion\":8,\"base\":\"{}\",\"baseCommit\":\"{}\"}}",
                comparison.base_ref, comparison.base_sha
            ),
            None => "{\"schemaVersion\":8}".to_owned(),
        }
        .into(),
    });
    Artifact::finalize(
        directory,
        files,
        Some(
            publication
                .metadata(&BuildInventory {
                    config_path: "nested/mokly.config.json".to_owned(),
                    exported_at: "2026-09-26T12:00:00.000Z".to_owned(),
                    comparison,
                })
                .unwrap(),
        ),
    )
    .unwrap()
}

pub fn validate_plan(body: &[u8], output: &Artifact) -> BTreeMap<String, Vec<u8>> {
    let mut archive = tar::Archive::new(GzDecoder::new(body));
    let mut files = BTreeMap::new();
    let mut order = Vec::new();
    for file in archive.entries().unwrap() {
        let mut file = file.unwrap();
        assert!(file.header().entry_type().is_file());
        let path = file.path().unwrap().to_str().unwrap().to_owned();
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes).unwrap();
        assert_eq!(
            bytes,
            output
                .files
                .iter()
                .find(|file| file.path == path)
                .unwrap()
                .bytes
        );
        assert!(files.insert(path.clone(), bytes).is_none());
        order.push(path);
    }
    let manifest: Value = serde_json::from_slice(&files[MANIFEST]).unwrap();
    let marker: Value = serde_json::from_slice(&files[MARKER]).unwrap();
    assert_eq!(manifest["schemaVersion"], 3);
    assert_eq!(manifest.as_object().unwrap().len(), 10);
    assert_eq!(marker["schemaVersion"], 3);
    assert_eq!(order, [MANIFEST, MARKER, INDEX]);
    for entry in marker["files"].as_array().unwrap() {
        let path = entry["path"].as_str().unwrap();
        let actual = output.files.iter().find(|file| file.path == path).unwrap();
        assert_eq!(entry["sha256"], digest(&actual.bytes));
        assert_eq!(entry["size"], actual.bytes.len());
    }
    assert_eq!(
        marker["files"].as_array().unwrap().len() + 1,
        output.files.len()
    );
    files
}
