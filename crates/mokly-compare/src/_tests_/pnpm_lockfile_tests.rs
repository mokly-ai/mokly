//! pnpm lockfile values resolve from their YAML position, not from matching text.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

use crate::error::{Error, Result};
use crate::local_packages::validate;

fn check(path: &str, lock: &str) -> Result<()> {
    validate(&BTreeMap::from([(
        RepoPath::parse(path).unwrap(),
        lock.as_bytes().to_vec(),
    )]))
}

fn outside(path: &str, lock: &str) {
    assert!(
        matches!(check(path, lock), Err(Error::LocalOutside { .. })),
        "{path}: {lock}"
    );
}

#[test]
fn importer_specifiers_resolve_from_their_importer() {
    for lock in [
        "importers:\n  packages/a:\n    dependencies:\n      ui:\n        specifier: file:../../vendor/ui.tgz\n        version: file:vendor/ui.tgz\npackages:\n  ui@file:vendor/ui.tgz:\n    resolution: {tarball: file:vendor/ui.tgz}",
        "shared: &version 1.0.0\nimporters:\n  .:\n    dependencies:\n      ui: {specifier: *version, version: *version}",
    ] {
        let result = check("pnpm-lock.yaml", lock);
        assert!(result.is_ok(), "{lock}: {result:?}");
    }
}

#[test]
fn values_outside_importer_positions_use_the_lockfile_folder() {
    for lock in [
        "importers:\n  packages/a/b:\n    dependencies:\n      x:\n        specifier: link:../../x\n        version: link:../../x\npackages:\n  ui@1.0.0:\n    resolution: {tarball: 'link:../../x'}",
        "catalogs:\n  default:\n    ui:\n      specifier: file:../x.tgz\n      version: 1.0.0",
    ] {
        outside("pnpm-lock.yaml", lock);
    }
}

#[test]
fn merge_complex_and_alias_keys_cannot_move_an_importer() {
    for lock in [
        "<<: {importers: {'..': {dependencies: {ui: {specifier: 'link:../../x', version: 'link:../../x'}}}}}",
        "? [importers]\n: {'..': {dependencies: {ui: {specifier: 'link:../../x', version: 'link:../../x'}}}}",
        "up: &up '..'\nimporters:\n  *up :\n    dependencies:\n      ui: {specifier: 'link:../../x', version: 'link:../../x'}",
    ] {
        outside("a/b/pnpm-lock.yaml", lock);
    }
}

#[test]
fn path_fields_are_paths_even_when_they_contain_a_colon() {
    for lock in [
        "packages:\n  ui@1.0.0:\n    resolution: {directory: 'safe/../../outside:x'}",
        "shared: &outside 'safe/../../outside:x'\npackages:\n  ui@1.0.0:\n    resolution: {directory: *outside}",
    ] {
        outside("pnpm-lock.yaml", lock);
    }
}
