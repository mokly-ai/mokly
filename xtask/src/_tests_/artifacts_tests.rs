//! Native target mapping and injected artifact assembly.

use std::path::Path;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::artifacts::{Artifacts, CopyMock, DefaultArtifacts, Host, WriteMock};
use crate::command::CommandRunnerRunMock;
use mokly_model::typescript;

#[test]
fn maps_exactly_the_five_supported_targets() {
    for (os, architecture, package, executable) in [
        ("linux", "x86_64", "linux-x64-gnu", "mokly"),
        ("linux", "aarch64", "linux-arm64-gnu", "mokly"),
        ("macos", "x86_64", "darwin-x64", "mokly"),
        ("macos", "aarch64", "darwin-arm64", "mokly"),
        ("windows", "x86_64", "win32-x64-msvc", "mokly.exe"),
    ] {
        let host = Host::resolve(os, architecture).unwrap();
        assert_eq!(host.package, package);
        assert_eq!(host.executable, executable);
    }
    assert!(Host::resolve("windows", "aarch64").is_err());
    assert!(Host::resolve("linux", "riscv64").is_err());
}

#[test]
fn build_runs_cargo_before_copying_to_the_host_package() {
    let mock = Arc::new(Unimock::new((
        CommandRunnerRunMock.next_call(matching!((spec) if spec.display().contains("--target x86_64-unknown-linux-gnu") && spec.display().contains("--bin mokly") && spec.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CopyMock.next_call(matching!((source, destination) if *source == Path::new("/workspace/target/native/x86_64-unknown-linux-gnu/debug/mokly") && *destination == Path::new("/workspace/packages/native-linux-x64-gnu/bin/mokly"))).returns(Ok(())),
    )));
    let tasks: &dyn Artifacts = &DefaultArtifacts {
        workspace: "/workspace".into(),
        host: Host::resolve("linux", "x86_64").unwrap(),
        commands: mock.clone(),
        files: mock,
    };
    tasks.build_native().unwrap();
}

#[test]
fn generated_source_goes_to_the_viewer_import_path() {
    let mock = Arc::new(Unimock::new(WriteMock.next_call(matching!((path, text) if *path == Path::new("/workspace/packages/viewer/src/generated/model.ts") && *text == typescript::generate())).returns(Ok(()))));
    let tasks: &dyn Artifacts = &DefaultArtifacts {
        workspace: "/workspace".into(),
        host: Host::resolve("linux", "x86_64").unwrap(),
        commands: mock.clone(),
        files: mock,
    };
    tasks.generate_types().unwrap();
}
