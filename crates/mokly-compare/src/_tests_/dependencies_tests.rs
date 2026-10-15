//! Each dependency tier consumes only its required trait boundaries.

use std::collections::BTreeMap;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use mokly_git::identity::RepoPath;
use mokly_platform::locks::FileLock;
use mokly_sidecar::methods::ModuleResolution;
use unimock::{MockFn, Unimock, matching};

use crate::cache_types::{CacheMock, Lease, StorageMock};
use crate::commands::CommandsMock;
use crate::dependencies::{Dependencies, DependencyTiers};
use crate::dependency_types::{Fallback, Request, Tier};
use crate::error::Error;
use crate::inputs::Inputs;
use mokly_git::control::ClockMock;

fn request() -> Request {
    let inputs = Inputs {
        objects: BTreeMap::new(),
        files: BTreeMap::from([
            (
                RepoPath::parse("package-lock.json").unwrap(),
                b"base".to_vec(),
            ),
            (RepoPath::parse("package.json").unwrap(), b"{}".to_vec()),
        ]),
    };
    Request {
        base: inputs.clone(),
        head: inputs,
        source_root: "/cache/base".into(),
        head_root: "/repo".into(),
        source_identity: "commit".into(),
        configuration: RepoPath::parse("mokly.config.json").unwrap(),
        resolution: ModuleResolution {
            conditions: vec!["browser".into()],
            package_roots: vec!["packages/ui".into()],
            ..ModuleResolution::default()
        },
    }
}

fn working_tiers(cache: Unimock, commands: Unimock) -> DependencyTiers {
    DependencyTiers {
        cache: Arc::new(cache),
        commands: Arc::new(commands),
        storage: Arc::new(Unimock::new(())),
        clock: Arc::new(Unimock::new(())),
        timeout: Duration::from_secs(120),
        install_bytes: 10000,
    }
}

fn tiers(cache: Unimock, commands: Unimock) -> DependencyTiers {
    DependencyTiers {
        clock: Arc::new(Unimock::new(
            ClockMock::now
                .each_call(matching!())
                .returns(Duration::ZERO),
        )),
        ..working_tiers(cache, commands)
    }
}

#[test]
fn identical_inputs_use_head_without_cache_or_package_manager() {
    let result = working_tiers(Unimock::new(()), Unimock::new(()))
        .resolve(&request())
        .unwrap();
    assert_eq!(result.tier, Tier::Working);
    assert_eq!(result.node_modules, PathBuf::from("/repo/node_modules"));
    assert_eq!(
        result.module_resolution.package_roots,
        ["/repo", "/repo/packages/ui"]
    );
    assert_eq!(result.module_resolution.conditions, ["browser"]);
    assert!(result.warning.is_none());
}

#[test]
fn differing_inputs_acquire_the_content_addressed_install() {
    let mut request = request();
    request.head.files.clear();
    let guard: Box<dyn FileLock> = Box::new(Unimock::new(()));
    let cache = Unimock::new(
        CacheMock::get
            .next_call(matching!((_, actual, _) if actual.len() == 64))
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
    assert_eq!(
        result.repository_roots,
        [PathBuf::from("/repo"), PathBuf::from("/cache/deps")]
    );
}

#[test]
fn failed_or_unsupported_install_warns_but_cancellation_propagates() {
    let mut request = request();
    request.head.files.clear();
    let commands = Unimock::new(
        CommandsMock::run
            .next_call(matching!(_))
            .returns(Err(Error::InstallTimeout)),
    );
    let result = tiers(Unimock::new(()), commands).resolve(&request).unwrap();
    assert_eq!(result.tier, Tier::Fallback);
    let warning = result.warning.unwrap();
    assert_eq!(warning.code(), "base-dependencies");
    assert_eq!(warning.lockfile.unwrap().as_str(), "package-lock.json");
    request.base.files =
        BTreeMap::from([(RepoPath::parse("pnpm-lock.yaml").unwrap(), b"lock".to_vec())]);
    let fallback = tiers(Unimock::new(()), Unimock::new(()))
        .resolve(&request)
        .unwrap();
    assert_eq!(fallback.tier, Tier::Fallback);
    assert_eq!(
        fallback.warning.unwrap().lockfile.unwrap().as_str(),
        "pnpm-lock.yaml"
    );
}

#[test]
fn cancellation_never_becomes_a_fallback_warning() {
    let mut request = request();
    request.head.files.clear();
    let commands = Unimock::new(
        CommandsMock::run
            .next_call(matching!(_))
            .returns(Err(Error::Cancelled)),
    );
    assert!(matches!(
        tiers(Unimock::new(()), commands).resolve(&request),
        Err(Error::Cancelled)
    ));
}

#[test]
fn installer_copies_private_sources_and_captures_script_deadline_and_size_options() {
    let mut request = request();
    request.head.files.clear();
    let boundaries = Unimock::new((
        CommandsMock::run.next_call(matching!((command) if command.args == vec![OsString::from("--version")])).returns(Ok(b"11.0.0\n".to_vec())),
        CacheMock::get.next_call(matching!(_, _, _)).answers(&|_, _, _, builder| {
            builder.build(Path::new("/install"))?;
            Ok(Lease { directory: "/install".into(), guard: Box::new(Unimock::new(())) })
        }),
        StorageMock::copy.next_call(matching!((source, target, 10000) if source.ends_with("base") && target.ends_with("install"))).returns(Ok(())),
        CommandsMock::run.next_call(matching!((command) if command.directory == Path::new("/install") && command.timeout == Duration::from_secs(120) && command.byte_limit == Some(10000) && command.args.iter().any(|arg| arg == "--ignore-scripts") && command.args.first().unwrap() == "ci" && command.args.iter().any(|arg| arg == "--logs-dir") && Path::new(command.args.last().unwrap()) == Path::new("/install"))).returns(Ok(vec![])),
        StorageMock::remove.next_call(matching!((path) if *path == Path::new("/install/.npm-cache"))).returns(Ok(())),
    ));
    let tiers = DependencyTiers {
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
    assert_eq!(tiers.resolve(&request).unwrap().tier, Tier::Installed);
}

#[test]
fn each_install_failure_uses_a_typed_reason_and_the_lockfile_warning() {
    let mut request = request();
    request.head.files.clear();
    for (error, reason) in [
        (Error::InstallTimeout, Fallback::Timeout),
        (Error::CacheLimit { limit: 1 }, Fallback::Size),
        (Error::UnsupportedManager, Fallback::Unavailable),
        (Error::InstallFailed { status: Some(1) }, Fallback::Failed),
    ] {
        let commands = Unimock::new(
            CommandsMock::run
                .next_call(matching!(_))
                .returns(Err(error)),
        );
        let resolved = tiers(Unimock::new(()), commands).resolve(&request).unwrap();
        let warning = resolved.warning.unwrap();
        assert_eq!(warning.reason, reason);
        assert_eq!(
            warning.message(),
            format!(
                "base dependencies at \"package-lock.json\" could not be installed ({}); using working-tree dependencies",
                match reason {
                    Fallback::Timeout => "time limit",
                    Fallback::Size => "cache size limit",
                    Fallback::Unavailable => "package manager or lockfile unavailable",
                    _ => "installation failed",
                }
            )
        );
        assert_eq!(warning.configuration.as_str(), "mokly.config.json");
    }
}

#[test]
fn warnings_without_a_lockfile_name_the_actual_reason_without_a_fake_path() {
    let warning = crate::dependency_types::Warning {
        configuration: RepoPath::parse("mokly.config.json").unwrap(),
        lockfile: None,
        reason: Fallback::Unavailable,
    };
    assert_eq!(
        warning.message(),
        "base dependencies could not be installed (package manager or lockfile unavailable); using working-tree dependencies"
    );
}

#[test]
fn equal_inputs_with_an_outside_local_package_need_no_install_or_warning() {
    let mut request = request();
    request.base.files.insert(
        RepoPath::parse("package.json").unwrap(),
        br#"{"dependencies":{"shared":"file:../shared"}}"#.to_vec(),
    );
    request.head = request.base.clone();
    let result = working_tiers(Unimock::new(()), Unimock::new(()))
        .resolve(&request)
        .unwrap();
    assert_eq!(result.tier, Tier::Working);
    assert!(result.warning.is_none());
    assert_eq!(result.repository_roots, [request.head_root]);
}
