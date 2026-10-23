//! Ancestor lookup maps each tier and warns only for observed missing directories.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use mokly_git::control::ClockMock;
use mokly_git::identity::RepoPath;
use mokly_sidecar::methods::ModuleResolution;
use unimock::{MockFn, Unimock, matching};

use crate::ancestor_roots;
use crate::cache_types::{CacheMock, Lease, StorageMock};
use crate::commands::CommandsMock;
use crate::dependencies::{Dependencies, DependencyTiers};
use crate::dependency_types::{Fallback, Request, Tier};
use crate::inputs::Inputs;

#[test]
fn ancestors_are_nearest_first_and_end_at_the_repository() {
    assert_eq!(
        ancestor_roots::directories("app/nested"),
        ["app/nested", "app", ""]
    );
    assert_eq!(ancestor_roots::directories(""), [""]);
    assert_eq!(ancestor_roots::directories("."), [""]);
}

#[test]
fn installed_tier_requires_only_directories_that_the_head_used() {
    for directory in ["app/node_modules", "packages/ui/node_modules"] {
        for (used, present, expected) in [
            (false, false, Tier::Installed),
            (true, true, Tier::Installed),
            (true, false, Tier::Fallback),
        ] {
            let base = Inputs {
                objects: BTreeMap::new(),
                files: BTreeMap::from([
                    (RepoPath::parse("package.json").unwrap(), b"{}".to_vec()),
                    (
                        RepoPath::parse("package-lock.json").unwrap(),
                        b"{}".to_vec(),
                    ),
                ]),
            };
            let request = Request {
                base,
                head: Inputs {
                    objects: BTreeMap::new(),
                    files: BTreeMap::new(),
                },
                source_root: "/base".into(),
                install_scripts: false,
                source_identity: "commit".into(),
                head_root: "/head".into(),
                configuration: RepoPath::parse("app/nested/mokly.config.json").unwrap(),
                unmapped_directories: vec![],
                used_directories: if used { vec![directory.into()] } else { vec![] },
                resolution: ModuleResolution::default(),
            };
            let storage =
                if used {
                    Unimock::new(StorageMock::directory.next_call(matching!(_)).answers_arc(
                        Arc::new(move |_, path| {
                            assert_eq!(path, Path::new("/installed").join(directory));
                            Ok(present)
                        }),
                    ))
                } else {
                    Unimock::new(())
                };
            let tiers: &dyn Dependencies = &DependencyTiers {
                cache: Arc::new(Unimock::new(
                    CacheMock::get
                        .next_call(matching!(_, _, _))
                        .returns(Ok(Lease {
                            directory: "/installed".into(),
                            guard: Box::new(Unimock::new(())),
                        })),
                )),
                commands: Arc::new(Unimock::new(
                    CommandsMock::run
                        .next_call(matching!(_))
                        .returns(Ok(b"11".to_vec())),
                )),
                storage: Arc::new(storage),
                clock: Arc::new(Unimock::new(
                    ClockMock::now
                        .each_call(matching!())
                        .returns(Duration::ZERO),
                )),
                timeout: Duration::from_secs(120),
                install_bytes: 10000,
            };
            let resolved = tiers.resolve(&request).unwrap();
            assert_eq!(resolved.tier, expected);
            let root = if expected == Tier::Installed {
                "/installed"
            } else {
                "/head"
            };
            assert_eq!(
                resolved
                    .module_resolution
                    .package_roots
                    .iter()
                    .map(PathBuf::from)
                    .collect::<Vec<_>>(),
                [
                    Path::new(root).join("app/nested"),
                    Path::new(root).join("app"),
                    PathBuf::from(root)
                ]
            );
            if expected == Tier::Fallback {
                let warning = resolved.warning.unwrap();
                assert_eq!(warning.reason, Fallback::MissingDirectory(directory.into()));
                assert!(warning.message().contains(directory));
            } else {
                assert!(resolved.warning.is_none());
            }
            assert_eq!(
                resolved.module_resolution.dependency_root.as_deref(),
                Some(root)
            );
        }
    }
}

#[test]
fn outside_repository_importer_directories_still_fall_back() {
    let request = Request {
        base: Inputs::default(),
        head: Inputs::default(),
        source_root: "/base".into(),
        install_scripts: false,
        source_identity: "commit".into(),
        head_root: "/head".into(),
        configuration: RepoPath::parse("mokly.config.json").unwrap(),
        resolution: ModuleResolution::default(),
        used_directories: vec![],
        unmapped_directories: vec!["../outside/node_modules".into()],
    };
    let tiers: &dyn Dependencies = &DependencyTiers {
        cache: Arc::new(Unimock::new(())),
        commands: Arc::new(Unimock::new(())),
        storage: Arc::new(Unimock::new(())),
        clock: Arc::new(Unimock::new(())),
        timeout: Duration::from_secs(120),
        install_bytes: 10000,
    };
    let selected = tiers.resolve(&request).unwrap();
    assert_eq!(selected.tier, Tier::Fallback);
    let warning = selected.warning.unwrap();
    assert_eq!(warning.code(), "base-dependencies");
    assert!(warning.message().contains("../outside/node_modules"));
}

#[test]
fn a_repository_importer_directory_uses_the_working_tier_without_a_warning() {
    let request = Request {
        base: Inputs::default(),
        head: Inputs::default(),
        source_root: "/base".into(),
        install_scripts: false,
        source_identity: "commit".into(),
        head_root: "/head".into(),
        configuration: RepoPath::parse("mokly.config.json").unwrap(),
        resolution: ModuleResolution::default(),
        used_directories: vec![],
        unmapped_directories: vec!["packages/ui/node_modules".into()],
    };
    let tiers: &dyn Dependencies = &DependencyTiers {
        cache: Arc::new(Unimock::new(())),
        commands: Arc::new(Unimock::new(())),
        storage: Arc::new(Unimock::new(())),
        clock: Arc::new(Unimock::new(())),
        timeout: Duration::from_secs(120),
        install_bytes: 10000,
    };
    let selected = tiers.resolve(&request).unwrap();
    assert_eq!(selected.tier, Tier::Working);
    assert!(selected.warning.is_none());
    assert_eq!(
        selected.module_resolution.dependency_root.as_deref(),
        Some("/head")
    );
}
