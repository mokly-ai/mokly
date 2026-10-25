//! Yarn Berry Git and GitHub sources keep the fallback tier.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

use crate::error::{Error, Result};
use crate::local_packages::validate;

fn check(files: &[(&str, &str)]) -> Result<()> {
    validate(
        &files
            .iter()
            .map(|(path, bytes)| (RepoPath::parse(path).unwrap(), bytes.as_bytes().to_vec()))
            .collect::<BTreeMap<_, _>>(),
    )
}

fn manifest(range: &str, lock: &str) -> Result<()> {
    let manifest = serde_json::json!({ "dependencies": { "ui": range } }).to_string();
    check(&[("package.json", &manifest), ("yarn.lock", lock)])
}

const BERRY: &str = "__metadata:\n  version: 8\n";

#[test]
fn berry_manifest_git_and_github_ranges_fall_back() {
    for range in [
        "github:owner/repo",
        "owner/repo",
        "owner/repo#main",
        "git+https://example.com/owner/repo.git",
        "git://example.com/owner/repo.git",
        "ssh://git@example.com/owner/repo.git",
        "git@github.com:owner/repo.git",
        "https://example.com/owner/repo.git#main",
        "https://github.com/owner/repo",
        "https://token@github.com/owner/repo/tarball/main",
        "patch:ui@github%3Aowner%2Frepo#./ui.patch",
    ] {
        assert!(
            matches!(manifest(range, BERRY), Err(Error::InvalidInput { .. })),
            "{range}"
        );
    }
}

#[test]
fn other_berry_ranges_and_other_managers_keep_their_rules() {
    for range in [
        "npm:^1.0.0",
        "1.0.0",
        "https://example.com/ui-1.0.0.tgz",
        "workspace:*",
        "./packages/ui",
        "file:./vendor/ui.tgz",
    ] {
        let result = manifest(range, BERRY);
        assert!(result.is_ok(), "{range}: {result:?}");
    }
    for lock in ["# yarn lockfile v1\n", ""] {
        let result = if lock.is_empty() {
            check(&[(
                "package.json",
                r#"{"dependencies":{"ui":"github:owner/repo"}}"#,
            )])
        } else {
            manifest("github:owner/repo", lock)
        };
        assert!(result.is_ok(), "{lock:?}: {result:?}");
    }
}

#[test]
fn berry_lockfile_git_resolutions_fall_back_and_checksums_do_not() {
    for lock in [
        "__metadata: {version: 8}\nui:\n  resolution: 'ui@https://github.com/owner/repo.git#commit=abc'",
        "__metadata: {version: 8}\n'ui@owner/repo':\n  resolution: 'ui@npm:1.0.0'",
    ] {
        assert!(
            matches!(
                check(&[("yarn.lock", lock)]),
                Err(Error::InvalidInput { .. })
            ),
            "{lock}"
        );
    }
    let lock = "__metadata: {version: 8, cacheKey: 10c0}\n'ui@npm:1.0.0':\n  resolution: 'ui@npm:1.0.0'\n  checksum: 10c0/0123abcd\n  bin:\n    ui: bin/ui.js";
    let result = check(&[("yarn.lock", lock)]);
    assert!(result.is_ok(), "{result:?}");
}
