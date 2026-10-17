//! Version, process failure, and unavailable entry smoke checks.

use std::fs;
use std::path::PathBuf;

use mokly_sidecar::error::{Error, FailureKind, ProtocolError};
use mokly_sidecar::methods::{Call, ModuleResolution, ProcessCss};
use mokly_sidecar::pool::SidecarPool;

use super::super::{pool, pool_with_entry};

#[test]
fn wrong_package_version_fails_before_command_traffic() {
    let pool = pool("wrong-version");
    assert!(matches!(
        pool.request(Call::ProcessCss(ProcessCss {
            repository_roots: Vec::new(),
            context: "css".into(),
            source_root: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .to_string_lossy()
                .into_owned(),
            module_resolution: ModuleResolution::default(),
            postcss: "unused".into(),
            source_path: "unused".into(),
            text: String::new()
        })),
        Err(Error::Version { .. })
    ));
}

#[test]
fn process_crash_retries_once_and_bad_hello_fails_closed() {
    let call = || {
        Call::ProcessCss(ProcessCss {
            repository_roots: Vec::new(),
            context: "css".into(),
            source_root: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .to_string_lossy()
                .into_owned(),
            module_resolution: ModuleResolution::default(),
            postcss: "unused".into(),
            source_path: "unused".into(),
            text: String::new(),
        })
    };
    let crashed = pool_with_entry(
        &super::super::package_version::read(),
        "tests/fixtures/sidecar/crash-peer.mjs",
    );
    assert!(matches!(
        crashed.request(call()),
        Err(Error::RequestCrashed {
            kind: FailureKind::Bundle,
            ..
        })
    ));
    let malformed = pool_with_entry(
        &super::super::package_version::read(),
        "tests/fixtures/sidecar/bad-peer.mjs",
    );
    assert!(matches!(
        malformed.request(call()),
        Err(Error::Protocol(ProtocolError::Handshake))
    ));
    let unavailable = pool_with_entry(&super::super::package_version::read(), "missing-sidecar.js");
    assert!(matches!(
        unavailable.request(call()),
        Err(Error::Unavailable { .. })
    ));
}

#[test]
fn unavailable_source_directories_name_the_source_root() {
    let directory = tempfile::tempdir().unwrap();
    let file = directory.path().join("file");
    fs::write(&file, "not a directory").unwrap();
    for root in [directory.path().join("missing"), file] {
        let pool = pool(&super::super::package_version::read());
        let error = pool
            .request(Call::ProcessCss(ProcessCss {
                repository_roots: Vec::new(),
                context: "missing-source".into(),
                source_root: root.to_string_lossy().into_owned(),
                module_resolution: ModuleResolution::default(),
                postcss: "unused".into(),
                source_path: "unused".into(),
                text: String::new(),
            }))
            .unwrap_err();
        assert!(matches!(error, Error::Unavailable { part } if part == root.to_string_lossy()));
        pool.shutdown().unwrap();
    }
}
