//! Independent npm package roots share a single fake-clock deadline.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use mokly_git::control::ClockMock;
use mokly_git::identity::RepoPath;
use mokly_sidecar::methods::ModuleResolution;
use unimock::{MockFn, Unimock, matching};

use crate::cache_types::{Builder, StorageMock};
use crate::commands::CommandsMock;
use crate::dependencies::DependencyTiers;
use crate::dependency_types::Request;
use crate::error::{Error, Result};
use crate::inputs::Inputs;
use crate::install::Install;
use crate::manager::{Manager, Root};
use crate::manager_plan;

fn roots(inputs: &Inputs, configured: &[String]) -> Result<Vec<String>> {
    Ok(manager_plan::roots(inputs, configured)?
        .into_iter()
        .map(|root| root.directory)
        .collect())
}

fn npm(directory: &str) -> Root {
    Root {
        directory: directory.into(),
        manager: Manager::Npm,
        requested: None,
        version: "11.0.0".into(),
        classic: None,
    }
}

fn inputs(paths: &[&str]) -> Inputs {
    Inputs {
        files: paths
            .iter()
            .map(|path| (RepoPath::parse(path).unwrap(), b"{}".to_vec()))
            .collect(),
        objects: BTreeMap::new(),
    }
}

#[test]
fn plans_include_root_and_each_configured_independent_npm_lockfile() {
    let base = inputs(&[
        "package.json",
        "package-lock.json",
        "frontend/package.json",
        "frontend/package-lock.json",
        "unrelated/package-lock.json",
    ]);
    assert_eq!(
        roots(&base, &["frontend".into(), "frontend".into()]).unwrap(),
        ["", "frontend"]
    );
    let nested = inputs(&["frontend/package.json", "frontend/package-lock.json"]);
    assert_eq!(roots(&nested, &["frontend".into()]).unwrap(), ["frontend"]);
    assert!(roots(&nested, &[]).is_err());
}

#[test]
fn every_install_uses_the_remaining_shared_allowance_and_whole_tree_size_bound() {
    let request = Request {
        base: Inputs::default(),
        head: Inputs::default(),
        source_root: "/base".into(),
        unmapped_directories: vec![],
        used_directories: Vec::new(),
        source_identity: "commit".into(),
        head_root: "/repo".into(),
        configuration: RepoPath::parse("mokly.config.json").unwrap(),
        resolution: ModuleResolution::default(),
    };
    let clock = Unimock::new((
        ClockMock::now
            .next_call(matching!())
            .returns(Duration::from_secs(10)),
        ClockMock::now
            .next_call(matching!())
            .returns(Duration::from_secs(70)),
    ));
    let commands = Unimock::new((
        CommandsMock::run.next_call(matching!((command) if command.directory == Path::new("/install") && command.timeout == Duration::from_secs(90) && command.size_root.as_deref() == Some(Path::new("/install")))).returns(Ok(vec![])),
        CommandsMock::run.next_call(matching!((command) if command.directory == Path::new("/install/frontend") && command.timeout == Duration::from_secs(30))).returns(Ok(vec![])),
    ));
    let owner = DependencyTiers {
        cache: Arc::new(Unimock::new(())),
        storage: Arc::new(Unimock::new((
            StorageMock::copy
                .next_call(matching!(_, _, 1000))
                .returns(Ok(())),
            StorageMock::remove
                .next_call(matching!((path) if *path == Path::new("/install/.npm-cache")))
                .returns(Ok(())),
        ))),
        commands: Arc::new(commands),
        clock: Arc::new(clock),
        timeout: Duration::from_secs(100),
        install_bytes: 1000,
    };
    let builder: &dyn Builder = &Install {
        request: &request,
        owner: &owner,
        roots: vec![npm(""), npm("frontend")],
        deadline: Duration::from_secs(100),
    };
    builder.build(Path::new("/install")).unwrap();
}

#[test]
fn an_expired_shared_deadline_starts_no_next_package_manager() {
    let request = Request {
        base: Inputs::default(),
        head: Inputs::default(),
        source_root: "/base".into(),
        unmapped_directories: vec![],
        used_directories: Vec::new(),
        source_identity: "commit".into(),
        head_root: "/repo".into(),
        configuration: RepoPath::parse("mokly.config.json").unwrap(),
        resolution: ModuleResolution::default(),
    };
    let owner = DependencyTiers {
        cache: Arc::new(Unimock::new(())),
        storage: Arc::new(Unimock::new(
            StorageMock::copy
                .next_call(matching!(_, _, _))
                .returns(Ok(())),
        )),
        commands: Arc::new(Unimock::new(())),
        clock: Arc::new(Unimock::new(
            ClockMock::now
                .next_call(matching!())
                .returns(Duration::from_secs(100)),
        )),
        timeout: Duration::from_secs(100),
        install_bytes: 1000,
    };
    let builder: &dyn Builder = &Install {
        request: &request,
        owner: &owner,
        roots: vec![npm("frontend")],
        deadline: Duration::from_secs(100),
    };
    assert!(matches!(
        builder.build(Path::new("/install")),
        Err(Error::InstallTimeout)
    ));
}
