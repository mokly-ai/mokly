//! New manager inputs retain the existing local-package confinement rule.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

use crate::error::Error;
use crate::local_packages::validate;

#[test]
fn yarn_portals_resolutions_and_pnpm_overrides_cannot_escape_the_repository() {
    for manifest in [
        r#"{"dependencies":{"ui":"portal:../outside"}}"#,
        r#"{"resolutions":{"ui":"file:../outside"}}"#,
        r#"{"pnpm":{"overrides":{"ui":"file:../outside"}}}"#,
        r#"{"pnpm":{"patchedDependencies":{"ui@1":"../outside.patch"}}}"#,
        r#"{"dependencies":{"ui":"patch:ui@npm%3A1#../outside.patch"}}"#,
        r#"{"dependencies":{"ui":"patch:ui@npm%3A1#./inside.patch&../../outside.patch"}}"#,
        r#"{"dependencies":{"ui":"workspace:../outside"}}"#,
    ] {
        let files = BTreeMap::from([(
            RepoPath::parse("package.json").unwrap(),
            manifest.as_bytes().to_vec(),
        )]);
        assert!(
            matches!(validate(&files), Err(Error::LocalOutside { .. })),
            "{manifest}"
        );
    }
}

#[test]
fn pnpm_workspace_paths_and_catalog_specs_cannot_escape_the_repository() {
    for yaml in [
        "packages: ['../outside']",
        "overrides:\n  ui: file:../outside",
        "catalog:\n  ui: file:../outside",
        "catalog:\n  ui: 'patch:ui@npm%3A1#./inside.patch&../../outside.patch'",
        "catalog:\n  ui: workspace:../outside",
    ] {
        let files = BTreeMap::from([(
            RepoPath::parse("pnpm-workspace.yaml").unwrap(),
            yaml.as_bytes().to_vec(),
        )]);
        assert!(
            matches!(validate(&files), Err(Error::LocalOutside { .. })),
            "{yaml}"
        );
    }
}

#[test]
fn pnpm_aliases_are_checked_in_their_dependency_context() {
    for (yaml, valid) in [
        (
            "storeDir: ../external-store\npackages: ['packages/*']",
            true,
        ),
        ("shared: &shared ['packages/*']\npackages: *shared", true),
        (
            "shared: &shared ['a/../../outside']\npackages: *shared",
            false,
        ),
        (
            "storeDir: &outside file:../outside\ncatalog:\n  ui: *outside",
            false,
        ),
        (
            "shared: &local file:packages/ui\ncatalog:\n  ui: *local",
            true,
        ),
    ] {
        let files = BTreeMap::from([(
            RepoPath::parse("pnpm-workspace.yaml").unwrap(),
            yaml.as_bytes().to_vec(),
        )]);
        assert_eq!(validate(&files).is_ok(), valid, "{yaml}");
    }
}

fn validate_dependency(value: &str) -> bool {
    let manifest = format!(r#"{{"dependencies":{{"ui":"{value}"}}}}"#);
    let files = BTreeMap::from([(
        RepoPath::parse("package.json").unwrap(),
        manifest.into_bytes(),
    )]);
    validate(&files).is_ok()
}

#[test]
fn relative_workspace_dependencies_remain_confined() {
    assert!(!validate_dependency("workspace:../outside"));
    assert!(validate_dependency("workspace:./packages/ui"));
    assert!(validate_dependency("workspace:*"));
}

#[test]
fn patch_source_dependencies_and_flags_remain_confined() {
    assert!(!validate_dependency(
        "patch:ui@file%3A../outside#./inside.patch"
    ));
    assert!(!validate_dependency(
        "patch:ui@npm%3A1#./inside.patch&optional!../../outside.patch"
    ));
}

#[test]
fn project_relative_and_builtin_patch_paths_remain_valid() {
    assert!(validate_dependency(
        "patch:ui@npm%3A1#~/.yarn/patches/ui.patch&optional!builtin<compat/ui>"
    ));
    assert!(!validate_dependency("patch:ui@npm%3A1#~/../outside.patch"));
}

#[test]
fn project_relative_patches_use_the_governing_yarn_lockfile_root() {
    for (patch, valid) in [("~/.yarn/ui.patch", true), ("~/../outside.patch", false)] {
        let manifest = format!(r#"{{"dependencies":{{"ui":"patch:ui@npm%3A1#{patch}"}}}}"#);
        let files = BTreeMap::from([
            (RepoPath::parse("yarn.lock").unwrap(), b"lock".to_vec()),
            (
                RepoPath::parse("packages/ui/package.json").unwrap(),
                manifest.into_bytes(),
            ),
        ]);
        assert_eq!(validate(&files).is_ok(), valid, "{patch}");
    }
}

#[test]
fn berry_exec_descriptors_fall_back_before_the_manager_runs() {
    for (path, bytes) in [
        (
            "package.json",
            br#"{"dependencies":{"generator":"exec:./generator.cjs"}}"#.to_vec(),
        ),
        (
            "yarn.lock",
            b"__metadata: {version: 8}\ngenerator:\n  resolution: 'generator@exec:./generator.cjs::locator=root%40workspace%3A.'".to_vec(),
        ),
    ] {
        let files = BTreeMap::from([(RepoPath::parse(path).unwrap(), bytes)]);
        assert!(matches!(validate(&files), Err(Error::InvalidInput { .. })), "{path}");
    }
}

#[test]
fn workspace_brace_alternatives_are_confined_individually() {
    for (path, bytes) in [
        (
            "package.json",
            br#"{"workspaces":["packages/{ui,../../outside}"]}"#.to_vec(),
        ),
        (
            "pnpm-workspace.yaml",
            b"packages:\n  - packages/{ui,../../outside}".to_vec(),
        ),
    ] {
        let files = BTreeMap::from([(RepoPath::parse(path).unwrap(), bytes)]);
        assert!(
            matches!(validate(&files), Err(Error::LocalOutside { .. })),
            "{path}"
        );
    }
}

#[test]
fn npm_lockfile_paths_cannot_escape_the_repository() {
    for value in [
        r#"{"packages":{"node_modules/ui":{"resolved":"file:../outside.tgz"}}}"#,
        r#"{"packages":{"node_modules/ui":{"link":"../../outside"}}}"#,
    ] {
        let files = BTreeMap::from([
            (
                RepoPath::parse("package.json").unwrap(),
                br#"{"dependencies":{"ui":"1.0.0"}}"#.to_vec(),
            ),
            (
                RepoPath::parse("package-lock.json").unwrap(),
                value.as_bytes().to_vec(),
            ),
        ]);
        assert!(
            matches!(validate(&files), Err(Error::LocalOutside { .. })),
            "{value}"
        );
    }
}

#[test]
fn classic_workspace_specifications_resolve_from_the_classic_root() {
    for (lock, valid) in [
        ("# yarn lockfile v1\n", false),
        ("__metadata:\n  version: 8\n", true),
    ] {
        let files = BTreeMap::from([
            (
                RepoPath::parse("package.json").unwrap(),
                br#"{"private":true,"workspaces":["packages/*"]}"#.to_vec(),
            ),
            (
                RepoPath::parse("packages/app/package.json").unwrap(),
                br#"{"dependencies":{"ui":"../vendor/ui.tgz"}}"#.to_vec(),
            ),
            (
                RepoPath::parse("yarn.lock").unwrap(),
                lock.as_bytes().to_vec(),
            ),
        ]);
        let result = validate(&files);
        assert_eq!(result.is_ok(), valid, "{lock}: {result:?}");
        if !valid {
            assert!(matches!(result, Err(Error::LocalOutside { .. })), "{lock}");
        }
    }
}
