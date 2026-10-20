//! Manager selection reaches the real install boundary only with compatible versions.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;

use mokly_git::control::ClockMock;
use mokly_git::identity::RepoPath;
use mokly_sidecar::methods::ModuleResolution;
use unimock::{MockFn, Unimock, matching};

use crate::cache_types::{CacheMock, Lease};
use crate::commands::CommandsMock;
use crate::dependencies::{Dependencies, DependencyTiers};
use crate::dependency_types::{Request, Tier};
use crate::inputs::Inputs;

fn request(manager: &str, lock: &str, content: &str, config: Option<&str>) -> Request {
    let mut files = BTreeMap::from([
        (
            RepoPath::parse("package.json").unwrap(),
            format!(r#"{{"packageManager":"{manager}"}}"#).into_bytes(),
        ),
        (RepoPath::parse(lock).unwrap(), content.as_bytes().to_vec()),
    ]);
    if let Some(config) = config {
        files.insert(
            RepoPath::parse(".yarnrc.yml").unwrap(),
            config.as_bytes().to_vec(),
        );
    }
    Request {
        base: Inputs {
            files,
            objects: BTreeMap::new(),
        },
        head: Inputs::default(),
        source_root: "/sources".into(),
        source_identity: "commit".into(),
        head_root: "/head".into(),
        configuration: RepoPath::parse("mokly.config.json").unwrap(),
        used_directories: vec![],
        unmapped_directories: vec![],
        resolution: ModuleResolution::default(),
    }
}

fn owner(commands: Unimock, cache: Unimock) -> DependencyTiers {
    DependencyTiers {
        cache: Arc::new(cache),
        commands: Arc::new(commands),
        storage: Arc::new(Unimock::new(())),
        clock: Arc::new(Unimock::new(
            ClockMock::now
                .each_call(matching!())
                .returns(Duration::ZERO),
        )),
        timeout: Duration::from_secs(120),
        install_bytes: 10000,
    }
}

#[test]
fn compatible_pnpm_and_yarn_versions_select_installed_dependencies() {
    for (manager, version, lock, content, config) in [
        (
            "pnpm",
            "10.34.7",
            "pnpm-lock.yaml",
            "lockfileVersion: '9.0'",
            None,
        ),
        ("yarn", "1.22.22", "yarn.lock", "# yarn lockfile v1", None),
        (
            "yarn",
            "4.18.1",
            "yarn.lock",
            "__metadata:\n  version: 8",
            Some("nodeLinker: node-modules"),
        ),
    ] {
        let request = request(&format!("{manager}@{version}"), lock, content, config);
        let commands = Unimock::new(CommandsMock::run.next_call(matching!((command) if (command.program == "pnpm" || command.program == "yarn") && command.args == ["--version"])).returns(Ok(format!("{version}\n").into_bytes())));
        let cache = Unimock::new(
            CacheMock::get
                .next_call(matching!(_, _, _))
                .returns(Ok(Lease {
                    directory: "/install".into(),
                    guard: Box::new(Unimock::new(())),
                })),
        );
        assert_eq!(
            owner(commands, cache).resolve(&request).unwrap().tier,
            Tier::Installed
        );
    }
}

#[test]
fn unsupported_pins_and_pnp_fall_back_without_starting_an_installer() {
    for (request, reason) in [
        (
            request(
                "pnpm@999.0.0",
                "pnpm-lock.yaml",
                "lockfileVersion: '9.0'",
                None,
            ),
            "package manager version unsupported",
        ),
        (
            request("yarn@999.0.0", "yarn.lock", "# yarn lockfile v1", None),
            "package manager version unsupported",
        ),
        (
            request(
                "yarn@4.18.1",
                "yarn.lock",
                "__metadata:\n  version: 8",
                Some("nodeLinker: pnp"),
            ),
            "Yarn Plug'n'Play is unsupported",
        ),
    ] {
        let resolved = owner(Unimock::new(()), Unimock::new(()))
            .resolve(&request)
            .unwrap();
        assert_eq!(resolved.tier, Tier::Fallback);
        assert!(resolved.warning.unwrap().message().contains(reason));
    }
}
