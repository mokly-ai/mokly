//! Escaping local packages cannot read outside a base extraction.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

use crate::local_packages::validate;

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

#[test]
fn all_npm_directory_archive_and_override_forms_affect_the_source_key() {
    for value in [
        "file:packages/ui",
        "link:packages/ui",
        "./packages/ui",
        "../sibling",
        "/outside",
        "~/outside",
        "file:~/outside",
        "packages/ui.tgz",
        "./ui.tar.gz",
    ] {
        let bytes = format!("{{\"dependencies\":{{\"ui\":\"{value}\"}}}}").into_bytes();
        let inputs = crate::inputs::Inputs {
            files: BTreeMap::from([(RepoPath::parse("package.json").unwrap(), bytes)]),
            objects: BTreeMap::new(),
        };
        assert_ne!(inputs.key("npm", "a"), inputs.key("npm", "b"), "{value}");
    }
    for bytes in [
        br#"{"overrides":{"ui":"./packages/ui"}}"#.as_slice(),
        br#"{"overrides":{"parent":{"ui":"file:packages/ui"}}}"#,
    ] {
        let inputs = crate::inputs::Inputs {
            files: BTreeMap::from([(RepoPath::parse("package.json").unwrap(), bytes.to_vec())]),
            objects: BTreeMap::new(),
        };
        assert_ne!(inputs.key("npm", "a"), inputs.key("npm", "b"));
    }
    for value in ["~/outside", "file:~/outside", "/outside", "../outside"] {
        let files = BTreeMap::from([(
            RepoPath::parse("package.json").unwrap(),
            format!("{{\"dependencies\":{{\"ui\":\"{value}\"}}}}").into_bytes(),
        )]);
        assert!(matches!(
            validate(&files),
            Err(crate::error::Error::LocalOutside { .. })
        ));
    }
}

#[test]
fn tilde_registry_ranges_are_not_home_paths() {
    for value in [
        "~1.2.3",
        "^2",
        "latest",
        "npm:pkg@~1",
        "https://example.invalid/pkg.tgz",
    ] {
        assert!(crate::manifest::local(value).is_none(), "{value}");
    }
}
