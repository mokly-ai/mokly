//! Artifact commands do not select a verification executor.

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::application::{Application, Xtask};
use crate::artifacts::{BuildNativeMock, GenerateTypesMock};
use crate::cli::Command;

#[test]
fn application_dispatches_native_build_and_type_generation() {
    let artifacts = Arc::new(Unimock::new((
        BuildNativeMock.next_call(matching!()).returns(Ok(())),
        GenerateTypesMock.next_call(matching!()).returns(Ok(())),
    )));
    let unused = Arc::new(Unimock::new(()));
    let application = Application {
        artifacts,
        selector: unused.clone(),
        check_runner: unused.clone(),
        remote_runner: unused.clone(),
        rust_file_length_auditor: unused.clone(),
        environment: unused.clone(),
        reporter: unused.clone(),
        interrupt: unused,
        workspace: "/fixture".into(),
    };
    application.run(Command::BuildNative).unwrap();
    application.run(Command::GenerateTypes).unwrap();
}
