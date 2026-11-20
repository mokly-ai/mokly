//! Dependency cache builds announce installation before work, while complete entries are silent.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use mokly_git::control::ClockMock;
use mokly_platform::locks::FileLock;
use unimock::{MockFn, Unimock, matching};

use crate::cache_types::{CacheMock, Kind, Lease, StorageMock};
use crate::commands::CommandsMock;
use crate::comparison_steps::{Step, StepsMock};
use crate::dependencies::{Dependencies, DependencyTiers};
use crate::dependency_types::Tier;

use super::dependencies_tests::{request, tiers};

#[test]
fn differing_inputs_reuse_the_content_addressed_install_without_a_step() {
    let mut request = request();
    request.head.files.clear();
    let guard: Box<dyn FileLock> = Box::new(Unimock::new(()));
    let cache = Unimock::new(
        CacheMock::get
            .next_call(matching!((Kind::Dependencies, actual, _) if actual.len() == 64))
            .returns(Ok(Lease {
                directory: "/cache/deps".into(),
                guard,
            })),
    );
    let commands = Unimock::new(
        CommandsMock::run
            .next_call(matching!((command) if command.args == vec![OsString::from("--version")]))
            .returns(Ok(b"11.0.0\n".to_vec())),
    );
    let result = tiers(cache, commands).resolve(&request).unwrap();
    assert_eq!(result.tier, Tier::Installed);
    assert_eq!(
        result.node_modules,
        PathBuf::from("/cache/deps/node_modules")
    );
    assert!(result.lease.is_some());
    assert_eq!(result.lease.unwrap().directory, Path::new("/cache/deps"));
    assert_eq!(
        result.repository_roots,
        [PathBuf::from("/repo"), PathBuf::from("/cache/deps")]
    );
}

#[test]
fn installer_copies_private_sources_and_captures_script_deadline_and_size_options() {
    let mut request = request();
    request.head.files.clear();
    let boundaries = Unimock::new((
        CommandsMock::run.next_call(matching!((command) if command.args == vec![OsString::from("--version")])).returns(Ok(b"11.0.0\n".to_vec())),
        CacheMock::get.next_call(matching!(Kind::Dependencies, _, _)).answers(&|_, _, _, builder| {
            builder.build(Path::new("/install"))?;
            assert!(builder.reusable());
            Ok(Lease { directory: "/install".into(), guard: Box::new(Unimock::new(())) })
        }),
        StepsMock::step.next_call(matching!(Step::Installing)).returns(()),
        StorageMock::copy.next_call(matching!((source, target, 10000) if source.ends_with("base") && target.ends_with("install"))).returns(Ok(())),
        CommandsMock::run.next_call(matching!((command) if command.directory == Path::new("/install") && command.timeout == Duration::from_secs(120) && command.byte_limit == Some(10000) && command.args.iter().any(|arg| arg == "--ignore-scripts") && command.args.first().unwrap() == "ci" && command.args.iter().any(|arg| arg == "--logs-dir") && Path::new(command.args.last().unwrap()) == Path::new("/install"))).returns(Ok(vec![])),
        StorageMock::remove.next_call(matching!((path) if *path == Path::new("/install/.npm-cache"))).returns(Ok(())),
    ));
    let tiers = DependencyTiers {
        steps: Arc::new(boundaries.clone()),
        cache: Arc::new(boundaries.clone()),
        commands: Arc::new(boundaries.clone()),
        storage: Arc::new(boundaries),
        clock: Arc::new(Unimock::new(
            ClockMock::now
                .some_call(matching!())
                .returns(Duration::ZERO)
                .at_least_times(0),
        )),
        timeout: Duration::from_secs(120),
        install_bytes: 10000,
    };
    let installed = tiers.resolve(&request).unwrap();
    assert_eq!(installed.tier, Tier::Installed);
    assert_eq!(installed.lease.unwrap().directory, Path::new("/install"));
}
