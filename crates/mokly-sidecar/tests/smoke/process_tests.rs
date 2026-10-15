//! Version, process failure, and unavailable entry smoke checks.

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
            source_root: "/repo".into(),
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
            source_root: "/repo".into(),
            module_resolution: ModuleResolution::default(),
            postcss: "unused".into(),
            source_path: "unused".into(),
            text: String::new(),
        })
    };
    let crashed = pool_with_entry(
        env!("CARGO_PKG_VERSION"),
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
        env!("CARGO_PKG_VERSION"),
        "tests/fixtures/sidecar/bad-peer.mjs",
    );
    assert!(matches!(
        malformed.request(call()),
        Err(Error::Protocol(ProtocolError::Handshake))
    ));
    let unavailable = pool_with_entry(env!("CARGO_PKG_VERSION"), "missing-sidecar.js");
    assert!(matches!(
        unavailable.request(call()),
        Err(Error::Unavailable { .. })
    ));
}
