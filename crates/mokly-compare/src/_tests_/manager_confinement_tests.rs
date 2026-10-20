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
