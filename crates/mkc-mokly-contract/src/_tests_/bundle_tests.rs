//! Plan contract tests mock the streaming reader instead of performing IO.

use std::io::Cursor;
use std::sync::Arc;

use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use unimock::{MockFn, Unimock, matching};

use crate::archive::{ArchiveFiles, ReaderMock};
use crate::bundle::{ContractValidator, PlanBundle, UploadValidator};
use crate::error::{Error, Limit, Rejection, Result};
use crate::limits::Limits;
use crate::scanned_archive::ScannedArchive;

const MARKER: &str = ".mokly-export-artifact";

fn digest(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub(super) fn entry(path: &str, bytes: &[u8]) -> Value {
    json!({"path": path, "sha256": digest(bytes), "size": bytes.len()})
}

fn current_only_manifest() -> Vec<u8> {
    serde_json::to_vec(&json!({"schemaVersion":3,"moklyVersion":"0.18.0","repository":{"host":"github.com","owner":"mokly-ai","name":"mokly-cloud"},"branch":"feature/test","headSha":"a".repeat(40),"baseRef":null,"baseSha":null,"pullRequest":null,"configPath":"mokly.config.json","exportedAt":"2024-02-29T12:30:40.123Z"})).unwrap()
}

pub(super) fn current_only_index() -> Vec<u8> {
    serde_json::to_vec(
        &json!({"schemaVersion":9,"changesStatus":"disabled","comparisonUrl":null,
        "components":[],"documents":[],"pages":[],"screens":[],"useCases":[],"removedEntries":[]}),
    )
    .unwrap()
}

/// A current-only plan whose marker declares `extra` beside the required files.
pub(super) fn plan(extra: &[Value]) -> ArchiveFiles {
    let envelope = current_only_manifest();
    let index = current_only_index();
    let mut files = vec![
        entry("index.html", b"home"),
        entry("404.html", b"missing"),
        entry("mokly-upload.json", &envelope),
        entry("mokly-viewer/index.json", &index),
    ];
    files.extend_from_slice(extra);
    ArchiveFiles::from([
        ("mokly-upload.json".to_owned(), envelope.into()),
        ("mokly-viewer/index.json".to_owned(), index.into()),
        (
            MARKER.to_owned(),
            serde_json::to_vec(&json!({"schemaVersion":3,"files":files}))
                .unwrap()
                .into(),
        ),
    ])
}

/// The released fixture's exact plan archive contents, including a comparison.
pub(super) fn compared() -> ArchiveFiles {
    let envelope = include_bytes!("../../fixtures/mokly-upload.json").to_vec();
    ArchiveFiles::from([
        ("mokly-upload.json".to_owned(), envelope.into()),
        (
            MARKER.to_owned(),
            include_bytes!("../../fixtures/inventory.json")
                .to_vec()
                .into(),
        ),
        (
            "mokly-viewer/index.json".to_owned(),
            include_bytes!("../../fixtures/index-v9.json")
                .to_vec()
                .into(),
        ),
    ])
}

pub(super) fn marker(files: &ArchiveFiles) -> Value {
    serde_json::from_slice(&files[MARKER]).unwrap()
}

pub(super) fn with_marker(mut files: ArchiveFiles, marker: &Value) -> ArchiveFiles {
    files.insert(
        MARKER.to_owned(),
        serde_json::to_vec(marker).unwrap().into(),
    );
    files
}

pub(super) fn validate(files: ArchiveFiles) -> Result<PlanBundle> {
    validate_with_limits(files, Limits::default())
}

pub(super) fn validate_with_limits(files: ArchiveFiles, limits: Limits) -> Result<PlanBundle> {
    let validator: &dyn UploadValidator = &ContractValidator {
        reader: Arc::new(Unimock::new(
            ReaderMock::read
                .next_call(matching!(_, _))
                .returns(ScannedArchive::from_files(files, limits)),
        )),
        limits,
    };
    validator.validate(&mut Cursor::new(Vec::<u8>::new()))
}

pub(super) fn rejected(files: ArchiveFiles, expected: Rejection) {
    let result = validate(files);
    assert!(
        matches!(&result, Err(Error::Invalid { reason }) if *reason == expected),
        "{expected:?}: {result:?}"
    );
}

#[test]
fn validates_a_current_only_plan_and_preserves_artifact_bytes() {
    let files = plan(&[]);
    let bundle = validate(files.clone()).unwrap();
    assert!(bundle.index().comparison_generation().is_none());
    assert_eq!(bundle.inventory().files.len(), 4);
    let artifacts = bundle.artifacts();
    assert_eq!(artifacts.len(), 3);
    for artifact in artifacts {
        assert_eq!(artifact.bytes, files[&artifact.path]);
    }
}

#[test]
fn validates_the_released_comparison_plan() {
    let bundle = validate(compared()).unwrap();
    assert!(bundle.index().comparison_generation().is_some());
    assert_eq!(bundle.artifacts().len(), 3);
}

#[test]
fn versions_and_limits_precede_structure() {
    let mut files = plan(&[]);
    files.insert("unexpected.html".to_owned(), vec![].into());
    files.insert(
        "mokly-upload.json".to_owned(),
        br#"{"schemaVersion":1,"newRoot":true}"#.to_vec().into(),
    );
    assert_eq!(validate(files.clone()).unwrap_err().status_code(), 426);
    files.insert(MARKER.to_owned(), vec![b' '; 64 * 1024 * 1024 + 1].into());
    assert!(matches!(
        validate(files),
        Err(Error::TooLarge { limit: Limit::File })
    ));
    let mut marker = marker(&plan(&[]));
    marker["schemaVersion"] = json!(1);
    assert_eq!(
        validate(with_marker(plan(&[]), &marker))
            .unwrap_err()
            .status_code(),
        426
    );
}

#[test]
fn declared_sizes_above_six_gib_are_rejected() {
    let large: Vec<Value> = (0..96)
        .map(|n| json!({"path":format!("static/{n}.bin"),"sha256":"a".repeat(64),"size":64 * 1024 * 1024}))
        .collect();
    assert!(matches!(
        validate(plan(&large)),
        Err(Error::TooLarge {
            limit: Limit::DeclaredBytes
        })
    ));
}

#[test]
fn requires_the_artifacts_and_the_root_declarations() {
    for path in ["mokly-upload.json", MARKER, "mokly-viewer/index.json"] {
        let mut files = plan(&[]);
        files.remove(path);
        rejected(files, Rejection::MissingFile);
    }
    for path in [
        "index.html",
        "404.html",
        "mokly-upload.json",
        "mokly-viewer/index.json",
    ] {
        let files = plan(&[]);
        let mut marker = marker(&files);
        marker["files"]
            .as_array_mut()
            .unwrap()
            .retain(|entry| entry["path"] != path);
        rejected(with_marker(files, &marker), Rejection::MissingFile);
    }
}

#[test]
fn the_plan_archive_holds_exactly_its_artifacts() {
    let mut files = plan(&[]);
    files.insert("index.html".to_owned(), b"home".to_vec().into());
    rejected(files, Rejection::PlanFiles);
    let mut files = compared();
    files.insert("404.html".to_owned(), b"missing".to_vec().into());
    rejected(files, Rejection::PlanFiles);
}

#[test]
fn archived_artifacts_match_their_declared_digest_and_size() {
    let files = plan(&[]);
    let mut marker = marker(&files);
    marker["files"][2]["size"] = json!(1);
    rejected(
        with_marker(files.clone(), &marker),
        Rejection::ArtifactDigest,
    );
    let mut marker = self::marker(&files);
    marker["files"][2]["sha256"] = json!("b".repeat(64));
    rejected(with_marker(files, &marker), Rejection::ArtifactDigest);
    let files = compared();
    let mut marker = self::marker(&files);
    for entry in marker["files"].as_array_mut().unwrap() {
        if entry["path"]
            .as_str()
            .unwrap()
            .eq("mokly-viewer/index.json")
        {
            entry["size"] = json!(1);
        }
    }
    rejected(with_marker(files, &marker), Rejection::ArtifactDigest);
}

#[test]
fn declared_paths_follow_the_hosting_policy() {
    for path in [
        "src/app.tsx",
        "mokly-manifest.json",
        ".git/config",
        "a/b.map",
    ] {
        rejected(plan(&[entry(path, b"x")]), Rejection::PrivateFile);
    }
    for path in ["_access", "__blobs/x"] {
        rejected(plan(&[entry(path, b"x")]), Rejection::Path);
    }
    rejected(
        plan(&[entry("mokly-viewer/diffs/generations/x/review.json", b"x")]),
        Rejection::ComparisonFiles,
    );
}

#[test]
fn comparison_generation_is_checked() {
    let files = compared();
    let mut marker = self::marker(&files);
    marker["files"].as_array_mut().unwrap().push(entry(
        "mokly-viewer/diffs/generations/other/review.json",
        b"x",
    ));
    rejected(with_marker(files, &marker), Rejection::ComparisonFiles);
}

#[test]
fn reader_rejections_propagate_without_inventing_a_bundle() {
    let validator: &dyn UploadValidator = &ContractValidator {
        reader: Arc::new(Unimock::new(
            ReaderMock::read
                .next_call(matching!(_, _))
                .returns(Err(Error::TooLarge {
                    limit: Limit::Compressed,
                })),
        )),
        limits: Limits::default(),
    };
    assert!(matches!(
        validator.validate(&mut Cursor::new(Vec::<u8>::new())),
        Err(Error::TooLarge {
            limit: Limit::Compressed
        })
    ));
}
