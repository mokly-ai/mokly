//! Lock dialect, version, and cache identity proofs without IO.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

use crate::error::Error;
use crate::inputs::Inputs;
use crate::install;
use crate::manager::{Manager, Root};
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
    let key = install::key(&base, "commit", &plans);
    assert_ne!(key, install::key(&base, "other-commit", &plans));
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
        assert_ne!(key, install::key(&base, "commit", &[changed]));
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
        assert_ne!(key, install::key(&changed, "commit", &plans));
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
    assert_eq!(root.berry_cache.as_deref(), Some("app/.yarn/app-cache"));
}
