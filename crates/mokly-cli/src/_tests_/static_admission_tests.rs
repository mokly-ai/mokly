//! Configuration and reservation call order is independent of renderer availability.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::ConfigLoaderMock;
use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_static::error::Error;
use mokly_static::transaction::TransactionsMock;
use unimock::{MockFn, Unimock, matching};

use crate::build::BuildError;
use crate::cancellation::CancellationMock;
use crate::grammar::{Build, Common};
use crate::static_admission::{Admission, OutputAdmission};

#[test]
fn configuration_is_loaded_once_then_output_is_reserved_before_return() {
    let mocks = Arc::new(Unimock::new((
        ConfigLoaderMock::load.next_call(matching!(_, _)).returns(Ok(config())),
        CancellationMock::drain.next_call(matching!()).returns(()),
        CancellationMock::requested.next_call(matching!()).returns(false),
        TransactionsMock::open.next_call(matching!((path, boundary) if *path==Path::new("/repo/site") && boundary.allowed==Path::new("/repo")))
            .returns(Ok(Box::new(Unimock::new(())) as Box<dyn mokly_static::transaction::Transaction>)),
    )));
    let service: &dyn Admission = &OutputAdmission {
        config: mocks.clone(),
        transactions: mocks.clone(),
        cancellation: mocks,
        runtime_roots: vec![],
    };
    assert_eq!(
        service
            .open(Path::new("/repo"), &options(), false)
            .unwrap()
            .config
            .repo_root,
        Path::new("/repo")
    );
}
#[test]
fn a_reservation_failure_keeps_its_recovery_category() {
    let mocks = Arc::new(Unimock::new((
        ConfigLoaderMock::load
            .next_call(matching!(_, _))
            .returns(Ok(config())),
        CancellationMock::drain.next_call(matching!()).returns(()),
        CancellationMock::requested
            .next_call(matching!())
            .returns(false),
        TransactionsMock::open
            .next_call(matching!(_, _))
            .returns(Err(Error::Reserved {
                path: "/kept/lock".into(),
            })),
    )));
    let service: &dyn Admission = &OutputAdmission {
        config: mocks.clone(),
        transactions: mocks.clone(),
        cancellation: mocks,
        runtime_roots: vec![],
    };
    assert!(matches!(
        service.open(Path::new("/repo"), &options(), false),
        Err(BuildError::Static {
            source: Error::Reserved { .. }
        })
    ));
}
fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: vec![],
        roots: vec![],
    }
}
fn options() -> Build {
    Build {
        common: Common::default(),
        out: Some("site".into()),
        strict: false,
        no_changes: true,
    }
}
