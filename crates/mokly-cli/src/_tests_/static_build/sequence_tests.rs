//! Every pipeline outcome has one drain and one transaction settlement.

use std::path::Path;
use std::sync::{Arc, Mutex};

use crate::build::BuildError;
use crate::static_build::{Request, StaticBuild};

use super::mocks::mocks;
use super::support::{Case, config, options};

#[test]
fn success_drains_after_staging_and_rechecks_then_installs_once() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let (builder, mut transaction) = mocks(Case::default(), events.clone());
    let config = config();
    let options = options();
    let (artifact, _) = builder
        .build(
            Request {
                cwd: Path::new("/repo"),
                config: &config,
                options: &options,
                viewer: vec![],
                repository: Path::new("/repo"),
                publication: None,
                warnings_are_fatal: false,
            },
            &mut transaction,
        )
        .unwrap();
    assert_eq!(artifact.directory, Path::new("/repo/site"));
    assert_eq!(
        *events.lock().unwrap(),
        [
            "fingerprint",
            "render",
            "protect",
            "assemble",
            "stage",
            "verify",
            "signals",
            "cancelled",
            "stop",
            "install"
        ]
    );
}

#[test]
fn each_preinstall_failure_drains_then_abandons_and_never_installs() {
    for fail in [
        "fingerprint",
        "render",
        "protect",
        "assemble",
        "stage",
        "verify",
    ] {
        let events = Arc::new(Mutex::new(Vec::new()));
        let (builder, mut transaction) = mocks(
            Case {
                fail,
                ..Default::default()
            },
            events.clone(),
        );
        let config = config();
        let options = options();
        assert!(
            builder
                .build(
                    Request {
                        cwd: Path::new("/repo"),
                        config: &config,
                        options: &options,
                        viewer: vec![],
                        repository: Path::new("/repo"),
                        publication: None,
                        warnings_are_fatal: false
                    },
                    &mut transaction
                )
                .is_err()
        );
        let events = events.lock().unwrap();
        assert_eq!(
            &events[events.len() - 4..],
            ["signals", "cancelled", "stop", "abandon"]
        );
        assert!(!events.contains(&"install"));
        assert_eq!(
            events.iter().filter(|event| **event == "abandon").count(),
            1
        );
    }
}

#[test]
fn cancellation_stop_failures_and_cleanup_failures_keep_their_typed_causes() {
    for (case, expected) in [
        (
            Case {
                final_fingerprint_fails: true,
                ..Default::default()
            },
            "recheck",
        ),
        (
            Case {
                input_changes: true,
                ..Default::default()
            },
            "recheck",
        ),
        (
            Case {
                cancelled: true,
                ..Default::default()
            },
            "cancelled",
        ),
        (
            Case {
                fail: "render",
                cancelled: true,
                ..Default::default()
            },
            "interrupted",
        ),
        (
            Case {
                fail: "render",
                stop_fails: true,
                ..Default::default()
            },
            "shutdown",
        ),
        (
            Case {
                stop_fails: true,
                ..Default::default()
            },
            "stop",
        ),
        (
            Case {
                fail: "render",
                abandon_fails: true,
                ..Default::default()
            },
            "cleanup",
        ),
        (
            Case {
                cancelled: true,
                abandon_fails: true,
                ..Default::default()
            },
            "cleanup",
        ),
        (
            Case {
                fail: "install",
                ..Default::default()
            },
            "install",
        ),
        (
            Case {
                warnings: true,
                ..Default::default()
            },
            "warnings",
        ),
    ] {
        let events = Arc::new(Mutex::new(Vec::new()));
        let (builder, mut transaction) = mocks(case, events.clone());
        let config = config();
        let options = options();
        let error = builder
            .build(
                Request {
                    cwd: Path::new("/repo"),
                    config: &config,
                    options: &options,
                    viewer: vec![],
                    repository: Path::new("/repo"),
                    publication: None,
                    warnings_are_fatal: case.warnings,
                },
                &mut transaction,
            )
            .unwrap_err();
        let actual = match error {
            BuildError::Cancelled => "cancelled",
            BuildError::Interrupted { .. } => "interrupted",
            BuildError::Shutdown { primary, shutdown } => {
                assert!(matches!(*primary, BuildError::Viewer));
                assert!(matches!(*shutdown, BuildError::Viewer));
                "shutdown"
            }
            BuildError::Cleanup { path, .. } => {
                assert!(path.ends_with("locks/site"));
                "cleanup"
            }
            BuildError::Viewer => "stop",
            BuildError::Warnings => "warnings",
            BuildError::Static { .. } => {
                if case.final_fingerprint_fails || case.input_changes {
                    "recheck"
                } else {
                    "install"
                }
            }
            _ => panic!("unexpected failure"),
        };
        assert_eq!(actual, expected);
        let events = events.lock().unwrap();
        assert_eq!(events.iter().filter(|event| **event == "stop").count(), 1);
        assert_eq!(events.contains(&"abandon"), expected != "install");
        if expected == "warnings" {
            assert!(!events.contains(&"assemble"));
        }
    }
}

#[test]
fn publication_reads_its_timestamp_only_when_finalizing_the_metadata() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let (builder, mut transaction) = mocks(
        Case {
            publication: true,
            ..Default::default()
        },
        events.clone(),
    );
    let config = config();
    let options = options();
    let publication = mokly_model::output::upload::Publication {
        mokly_version: "0.14.0".into(),
        repository: mokly_model::output::repository::Repository {
            host: "example.com".into(),
            owner: "team".into(),
            name: "site".into(),
        },
        branch: "main".into(),
        head_sha: "a".repeat(40),
        pull_request: None,
    };
    builder
        .build(
            Request {
                cwd: Path::new("/repo"),
                config: &config,
                options: &options,
                viewer: vec![],
                repository: Path::new("/repo"),
                publication: Some(publication),
                warnings_are_fatal: true,
            },
            &mut transaction,
        )
        .unwrap();
    let events = events.lock().unwrap();
    assert_eq!(
        events.iter().filter(|event| **event == "timestamp").count(),
        1
    );
    assert!(
        events.iter().position(|event| *event == "render")
            < events.iter().position(|event| *event == "timestamp")
    );
    assert!(
        events.iter().position(|event| *event == "timestamp")
            < events.iter().position(|event| *event == "assemble")
    );
}
