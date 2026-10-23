//! Lock dialect, version, and cache identity proofs without IO.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

use crate::error::Error;
use crate::inputs::Inputs;
use crate::install;
use crate::install_node::InstallNode;
use crate::manager::{Manager, RepositoryPath, Root};
use crate::manager_plan::roots;
use crate::manager_yaml;

fn inputs(files: &[(&str, &str)]) -> Inputs {
    Inputs {
        files: files
            .iter()
            .map(|(path, bytes)| (RepoPath::parse(path).unwrap(), bytes.as_bytes().to_vec()))
            .collect(),
        objects: BTreeMap::new(),
    }
}

#[test]
fn independent_managers_and_nested_workspace_roots_keep_their_own_versions() {
    let inputs = inputs(&[
        ("package.json", "{}"),
        ("npm-shrinkwrap.json", "{}"),
        (
            "frontend/package.json",
            r#"{"packageManager":"pnpm@10.34.7+sha512.abc"}"#,
        ),
        ("frontend/pnpm-lock.yaml", "lockfileVersion: '9.0'"),
        ("frontend/pnpm-workspace.yaml", "packages: ['packages/*']"),
        ("unrelated/yarn.lock", "# yarn lockfile v1"),
    ]);
    let roots = roots(&inputs, &["frontend/packages/ui".into()]).unwrap();
    assert_eq!(
        roots
            .iter()
            .map(|root| root.directory.as_str())
            .collect::<Vec<_>>(),
        ["", "frontend"]
    );
    assert_eq!(roots[0].manager, Manager::Npm);
    assert_eq!(roots[1].manager, Manager::Pnpm);
    assert_eq!(roots[1].requested.as_deref(), Some("10.34.7"));
}

#[test]
fn keys_cover_manager_version_root_configuration_and_repository_sources() {
    let base = inputs(&[
        ("package.json", "{}"),
        ("pnpm-lock.yaml", "lockfileVersion: '9.0'"),
    ]);
    let mut plans = roots(&base, &[]).unwrap();
    plans[0].validate_version(b"10.34.7\n").unwrap();
    let node = InstallNode {
        version: "v24.21.0".into(),
        platform: "linux".into(),
        architecture: "x64".into(),
        executable: "/node/bin/node".into(),
    };
    let key = install::key(&base, "commit", &plans, None);
    assert_ne!(key, install::key(&base, "other-commit", &plans, None));
    assert_ne!(key, install::key(&base, "commit", &plans, Some(&node)));
    assert_ne!(
        install::key(&base, "commit", &plans, Some(&node)),
        install::key(
            &base,
            "commit",
            &plans,
            Some(&InstallNode {
                version: "v22.15.0".into(),
                ..node.clone()
            })
        )
    );
    for changed in [
        InstallNode {
            platform: "darwin".into(),
            ..node.clone()
        },
        InstallNode {
            architecture: "arm64".into(),
            ..node.clone()
        },
    ] {
        assert_ne!(
            install::key(&base, "commit", &plans, Some(&node)),
            install::key(&base, "commit", &plans, Some(&changed)),
        );
    }
    for changed in [
        Root {
            version: "10.0.0".into(),
            ..plans[0].clone()
        },
        Root {
            directory: "frontend".into(),
            ..plans[0].clone()
        },
        Root {
            manager: Manager::YarnClassic,
            ..plans[0].clone()
        },
    ] {
        assert_ne!(key, install::key(&base, "commit", &[changed], None));
    }
    for path in [
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        ".yarnrc.yml",
    ] {
        let mut changed = base.clone();
        changed
            .files
            .insert(RepoPath::parse(path).unwrap(), b"changed".to_vec());
        assert_ne!(key, install::key(&changed, "commit", &plans, None));
    }
}

#[test]
fn version_mismatches_and_unknown_dialects_do_not_run_installs() {
    let base = inputs(&[
        ("package.json", r#"{"packageManager":"pnpm@10.34.7"}"#),
        ("pnpm-lock.yaml", "lockfileVersion: '9.0'"),
    ]);
    let mut root = roots(&base, &[]).unwrap().remove(0);
    for version in [
        b"10.0.0".as_slice(),
        b"11.0.0",
        b"not a version",
        b"10.34.7-dev",
    ] {
        assert!(matches!(
            root.validate_version(version),
            Err(Error::UnsupportedVersion)
        ));
    }
    root.validate_version(b"10.34.7\n").unwrap();
    let base = inputs(&[
        ("package.json", "{}"),
        ("yarn.lock", "__metadata:\n  version: 8"),
    ]);
    assert!(matches!(roots(&base, &[]), Err(Error::YarnPnp)));
}

#[test]
fn yarn_config_projection_accepts_yaml_spelling_without_expanding_nested_aliases() {
    let parsed = manager_yaml::fields(b"'nodeLinker': \"node-modules\" # comment\nother: &anchor [one, two]\ncopy: [*anchor, *anchor]\n", ".yarnrc.yml").unwrap();
    assert_eq!(parsed["nodeLinker"].as_deref(), Some("node-modules"));
    assert!(
        manager_yaml::fields(b"nodeLinker: pnp\nnodeLinker: node-modules", ".yarnrc.yml").is_err()
    );
}

#[test]
fn berry_checks_restricted_configuration_in_every_repository_ancestor() {
    for ancestor in [
        "plugins:\n  - path: ./plugin.cjs",
        "networkSettings:\n  registry.example:\n    enableNetwork: true",
    ] {
        let base = inputs(&[
            (".yarnrc.yml", ancestor),
            ("app/package.json", r#"{"packageManager":"yarn@4.18.1"}"#),
            ("app/yarn.lock", "__metadata:\n  version: 8"),
            ("app/.yarnrc.yml", "nodeLinker: node-modules"),
        ]);
        assert!(matches!(
            roots(&base, &["app".into()]),
            Err(Error::InvalidInput { path }) if path == ".yarnrc.yml"
        ));
    }
}

#[test]
fn berry_uses_the_nearest_linker_setting_from_its_configuration_chain() {
    let mut base = inputs(&[
        (".yarnrc.yml", "nodeLinker: node-modules"),
        ("app/package.json", r#"{"packageManager":"yarn@4.18.1"}"#),
        ("app/yarn.lock", "__metadata:\n  version: 8"),
    ]);
    assert_eq!(
        roots(&base, &["app".into()]).unwrap()[0].manager,
        Manager::YarnBerry
    );
    base.files.insert(
        RepoPath::parse("app/.yarnrc.yml").unwrap(),
        b"nodeLinker: pnp".to_vec(),
    );
    assert!(matches!(roots(&base, &["app".into()]), Err(Error::YarnPnp)));
}

#[test]
fn berry_keeps_the_confined_nearest_cache_folder() {
    let base = inputs(&[
        (
            ".yarnrc.yml",
            "nodeLinker: node-modules\ncacheFolder: .yarn/root-cache",
        ),
        ("app/package.json", r#"{"packageManager":"yarn@4.18.1"}"#),
        ("app/yarn.lock", "__metadata:\n  version: 8"),
        ("app/.yarnrc.yml", "cacheFolder: .yarn/app-cache"),
    ]);
    let root = roots(&base, &["app".into()]).unwrap().remove(0);
    assert_eq!(
        root.berry_cache,
        Some(RepositoryPath::confine("app", ".yarn/app-cache").unwrap())
    );
}

#[test]
fn berry_configuration_ranges_cannot_add_exec_or_outside_sources() {
    for (config, local) in [
        ("catalog:\n  gen: 'exec:./gen.cjs'", false),
        ("catalogs:\n  tools:\n    gen: 'exec:./gen.cjs'", false),
        (
            "packageExtensions:\n  'ui@*':\n    dependencies:\n      gen: 'exec:./gen.cjs'",
            false,
        ),
        (
            "catalog:\n  gen: 'patch:gen@exec%3A./gen.cjs#./gen.patch'",
            false,
        ),
        (
            "shared: &gen 'exec:./gen.cjs'\ncatalog:\n  gen: *gen",
            false,
        ),
        ("defaultProtocol: 'exec:'", false),
        ("catalog:\n  ui: 'file:../outside.tgz'", true),
    ] {
        let base = inputs(&[
            ("package.json", r#"{"packageManager":"yarn@4.18.1"}"#),
            ("yarn.lock", "__metadata:\n  version: 8"),
            (
                ".yarnrc.yml",
                &format!("nodeLinker: node-modules\n{config}"),
            ),
        ]);
        let result = roots(&base, &[]);
        if local {
            assert!(
                matches!(result, Err(Error::LocalOutside { .. })),
                "{config}"
            );
        } else {
            assert!(
                matches!(result, Err(Error::InvalidInput { .. })),
                "{config}"
            );
        }
    }
    let base = inputs(&[
        ("package.json", r#"{"packageManager":"yarn@4.18.1"}"#),
        ("yarn.lock", "__metadata:\n  version: 8"),
        (
            ".yarnrc.yml",
            "nodeLinker: node-modules\ndefaultProtocol: 'npm:'\ncatalog:\n  ui: ^1.0.0",
        ),
    ]);
    assert_eq!(roots(&base, &[]).unwrap()[0].manager, Manager::YarnBerry);
}
