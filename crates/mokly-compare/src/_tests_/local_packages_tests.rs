//! Repository package overlays preserve npm workspace names and exclusions.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

use crate::local_packages::packages;

#[test]
fn excluded_workspaces_do_not_shadow_third_party_packages_and_missing_names_derive_from_folders() {
    let files = BTreeMap::from([
        (
            RepoPath::parse("package.json").unwrap(),
            br#"{"workspaces":["packages/*","!packages/excluded"]}"#.to_vec(),
        ),
        (
            RepoPath::parse("packages/ui/package.json").unwrap(),
            b"{}".to_vec(),
        ),
        (
            RepoPath::parse("packages/excluded/package.json").unwrap(),
            br#"{"name":"third-party"}"#.to_vec(),
        ),
    ]);
    assert_eq!(
        packages(&files).unwrap(),
        BTreeMap::from([("ui".into(), "packages/ui".into())])
    );
}

#[test]
fn override_directory_packages_keep_their_dependency_name() {
    let files = BTreeMap::from([(
        RepoPath::parse("package.json").unwrap(),
        br#"{"overrides":{"parent":{"owned":"./packages/owned"}}}"#.to_vec(),
    )]);
    assert_eq!(
        packages(&files).unwrap(),
        BTreeMap::from([("owned".into(), "packages/owned".into())])
    );
}
