//! Escaping local packages cannot read outside a base extraction.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

use crate::manifest::validate;

#[test]
fn local_packages_and_workspaces_are_confined_from_their_manifest_directory() {
    for value in [
        "file:../outside",
        "file:/outside",
        "file:C:/outside",
        "file:%2e%2e/outside",
        "link:../outside",
    ] {
        let files = BTreeMap::from([(
            RepoPath::parse("package.json").unwrap(),
            format!("{{\"dependencies\":{{\"local\":\"{value}\"}}}}").into_bytes(),
        )]);
        assert!(validate(&files).is_err(), "{value}");
    }
    for manifest in [
        br#"{"workspaces":["../outside"]}"#.as_slice(),
        br#"{"workspaces":{"packages":["../outside"]}}"#,
        b"invalid JSON",
    ] {
        let files = BTreeMap::from([(RepoPath::parse("package.json").unwrap(), manifest.to_vec())]);
        assert!(validate(&files).is_err());
    }
    let files = BTreeMap::from([
        (
            RepoPath::parse("packages/a/package.json").unwrap(),
            br#"{"dependencies":{"local":"file:../b"}}"#.to_vec(),
        ),
        (
            RepoPath::parse("package.json").unwrap(),
            br#"{"workspaces":["packages/*"]}"#.to_vec(),
        ),
    ]);
    assert!(validate(&files).is_ok());
}
