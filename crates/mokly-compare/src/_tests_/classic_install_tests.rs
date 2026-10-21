//! Classic installs keep the base configuration and pin a private mirror.

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
use crate::inputs::Inputs;
use crate::install::Install;
use crate::manager_plan;

fn build(yarnrc: &str, mirror: &'static str, removed: &'static [&'static str]) {
    let base = Inputs {
        files: [
            ("package.json", r#"{"packageManager":"yarn@1.22.22"}"#),
            ("yarn.lock", "# yarn lockfile v1\n"),
            (".yarnrc", yarnrc),
        ]
        .into_iter()
        .map(|(path, bytes)| (RepoPath::parse(path).unwrap(), bytes.as_bytes().to_vec()))
        .collect(),
        objects: BTreeMap::new(),
    };
    let mut root = manager_plan::roots(&base, &[]).unwrap().remove(0);
    root.version = "1.22.22".into();
    let request = Request {
        base,
        head: Inputs::default(),
        source_root: "/base".into(),
        unmapped_directories: vec![],
        used_directories: Vec::new(),
        install_scripts: false,
        source_identity: "commit".into(),
        head_root: "/repo".into(),
        configuration: RepoPath::parse("mokly.config.json").unwrap(),
        resolution: ModuleResolution::default(),
    };
    let owner = DependencyTiers {
        cache: Arc::new(Unimock::new(())),
        storage: Arc::new(Unimock::new((
            StorageMock::copy
                .next_call(matching!(_, _, 1000))
                .returns(Ok(())),
            StorageMock::prepare
                .next_call(matching!((path) if *path == Path::new(mirror)))
                .returns(Ok(())),
            StorageMock::remove
                .each_call(matching!((path) if removed.iter().any(|removed| *path == Path::new(removed))))
                .answers(&|_, _| Ok(())),
        ))),
        commands: Arc::new(Unimock::new(
            CommandsMock::run
                .next_call(matching!((command) if command.cache.as_deref() == Some(Path::new(mirror)) && command.args.iter().any(|arg| arg == "--cwd")))
                .returns(Ok(vec![])),
        )),
        clock: Arc::new(Unimock::new(
            ClockMock::now
                .next_call(matching!())
                .returns(Duration::ZERO),
        )),
        timeout: Duration::from_secs(100),
        install_bytes: 1000,
    };
    let builder: &dyn Builder = &Install {
        request: &request,
        owner: &owner,
        roots: vec![root],
        deadline: Duration::from_secs(100),
        node: None,
    };
    builder.build(Path::new("/install")).unwrap();
}

#[test]
fn a_classic_install_without_a_committed_mirror_pins_and_removes_a_private_one() {
    build(
        "--install.modules-folder \"../outside\"\n",
        "/install/.yarn-mirror",
        &[
            "/install/.yarn-cache",
            "/install/.yarn-global",
            "/install/.yarn-links",
            "/install/.yarn-offline-cache",
            "/install/.yarn-mutex.lock",
            "/install/.yarn-mirror",
        ],
    );
}

#[test]
fn a_classic_install_keeps_its_committed_mirror() {
    build(
        "yarn-offline-mirror \"./offline\"\n",
        "/install/offline",
        &[
            "/install/.yarn-cache",
            "/install/.yarn-global",
            "/install/.yarn-links",
            "/install/.yarn-offline-cache",
            "/install/.yarn-mutex.lock",
        ],
    );
}
