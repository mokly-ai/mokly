//! Lockfile sources obey confinement before any manager or storage operation.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;

use mokly_git::control::ClockMock;
use mokly_git::identity::RepoPath;
use mokly_sidecar::methods::ModuleResolution;
use unimock::{MockFn, Unimock, matching};

use crate::dependencies::{Dependencies, DependencyTiers};
use crate::dependency_types::{Fallback, Request, Tier};
use crate::error::Error;
use crate::inputs::Inputs;
use crate::local_packages::validate;

fn files(path: &str, lock: &str) -> BTreeMap<RepoPath, Vec<u8>> {
    BTreeMap::from([
        (
            RepoPath::parse("package.json").unwrap(),
            br#"{"dependencies":{"ui":"1.0.0"}}"#.to_vec(),
        ),
        (RepoPath::parse(path).unwrap(), lock.as_bytes().to_vec()),
    ])
}

#[test]
fn lockfile_only_paths_cannot_read_outside_archives_or_patches() {
    for (path, lock) in [
        (
            "pnpm-lock.yaml",
            "packages:\n  ui@1.0.0:\n    resolution: {tarball: 'file:/outside/ui.tgz'}",
        ),
        (
            "pnpm-lock.yaml",
            "importers:\n  .:\n    dependencies:\n      ui: {version: 'file:../outside/ui.tgz'}",
        ),
        (
            "yarn.lock",
            "# yarn lockfile v1\nui@1.0.0:\n  version \"1.0.0\"\n  resolved \"file:/outside/ui.tgz#hash\"",
        ),
        (
            "yarn.lock",
            "# yarn lockfile v1\nui@1.0.0:\n  \"resolved\" \"file:\\u002foutside/ui.tgz#hash\"",
        ),
        (
            "yarn.lock",
            "# yarn lockfile v1\n'ui@1.0.0':\n  resolved: 'file:../outside/ui.tgz'",
        ),
        (
            "yarn.lock",
            "__metadata: {version: 8}\nui:\n  resolution: 'ui@file:../outside/ui.tgz::locator=root%40workspace%3A.'",
        ),
        (
            "yarn.lock",
            "__metadata: {version: 8}\nui:\n  resolution: 'ui@patch:ui@npm%3A1#./inside.patch&../../outside.patch::version=1'",
        ),
    ] {
        assert!(
            matches!(
                validate(&files(path, lock)),
                Err(Error::LocalOutside { .. })
            ),
            "{path}: {lock}"
        );
    }
}

#[test]
fn confined_lockfile_sources_keep_their_project_and_importer_bases() {
    for (path, lock) in [
        (
            "pnpm-lock.yaml",
            "packages:\n  ui@file:vendor/ui.tgz:\n    resolution: {tarball: 'file:vendor/ui.tgz'}",
        ),
        (
            "yarn.lock",
            "# yarn lockfile v1\nui@1.0.0:\n  resolved \"https://registry.example/ui.tgz#hash\"",
        ),
        (
            "yarn.lock",
            "# yarn lockfile v1\nui@1.0.0:\n  resolved \"file:vendor/ui.tgz#hash\"",
        ),
        (
            "yarn.lock",
            "__metadata: {version: 8}\nui:\n  resolution: 'ui@file:../ui.tgz#../ui.tgz::locator=root%40workspace%3Apackages%2Fapp'",
        ),
        (
            "app/yarn.lock",
            "__metadata: {version: 8}\nui:\n  resolution: 'ui@patch:ui@npm%3A1#~/.yarn/ui.patch::version=1'",
        ),
    ] {
        assert!(validate(&files(path, lock)).is_ok(), "{path}: {lock}");
    }
}

#[test]
fn outside_lockfile_sources_start_no_process_and_read_no_storage() {
    let request = Request {
        base: Inputs {
            files: files(
                "pnpm-lock.yaml",
                "packages:\n  ui@1.0.0:\n    resolution: {tarball: 'file:/outside/ui.tgz'}",
            ),
            objects: BTreeMap::new(),
        },
        head: Inputs::default(),
        source_root: "/base".into(),
        head_root: "/working".into(),
        source_identity: "commit".into(),
        configuration: RepoPath::parse("mokly.config.json").unwrap(),
        resolution: ModuleResolution::default(),
        unmapped_directories: Vec::new(),
        used_directories: Vec::new(),
    };
    let tiers = DependencyTiers {
        cache: Arc::new(Unimock::new(())),
        commands: Arc::new(Unimock::new(())),
        storage: Arc::new(Unimock::new(())),
        clock: Arc::new(Unimock::new(
            ClockMock::now
                .each_call(matching!())
                .returns(Duration::ZERO),
        )),
        timeout: Duration::from_secs(120),
        install_bytes: 1000,
    };
    let result = tiers.resolve(&request).unwrap();
    assert_eq!(result.tier, Tier::Fallback);
    assert!(matches!(
        result.warning.unwrap().reason,
        Fallback::LocalOutside
    ));
}

#[test]
fn pnpm_bare_directory_and_patch_fields_cannot_escape_the_repository() {
    for lock in [
        "packages:\n  ui@1.0.0:\n    resolution: {directory: 'safe/../../outside'}",
        "patchedDependencies:\n  ui@1.0.0:\n    path: safe/../../outside.patch",
        "shared: &outside safe/../../outside\npackages:\n  ui@1.0.0:\n    resolution: {directory: *outside}",
    ] {
        assert!(
            matches!(
                validate(&files("pnpm-lock.yaml", lock)),
                Err(Error::LocalOutside { .. })
            ),
            "{lock}"
        );
    }
}

#[test]
fn yarn_file_selectors_cannot_escape_an_inside_source_path() {
    let lock = "__metadata: {version: 8}\nui:\n  resolution: 'ui@file:vendor/ui.tgz#safe/../../outside.tgz::locator=root%40workspace%3A.'";
    assert!(matches!(
        validate(&files("yarn.lock", lock)),
        Err(Error::LocalOutside { .. })
    ));
}

#[test]
fn yarn_locator_selectors_define_the_actual_importer_directory() {
    let lock = "__metadata: {version: 8}\nui:\n  resolution: 'ui@file:../outside.tgz::locator=root%40file%3Asafe%2Fdeep%23.'";
    assert!(matches!(
        validate(&files("yarn.lock", lock)),
        Err(Error::LocalOutside { .. })
    ));
}

#[test]
fn pnpm_importer_links_use_the_importer_directory_and_registry_urls_are_not_paths() {
    let lock = "importers:\n  packages/a:\n    dependencies:\n      b:\n        specifier: workspace:*\n        version: link:../b\npackages:\n  b@1.0.0:\n    resolution: {tarball: 'https://registry.example/@scope%2fb/-/b-1.0.0.tgz'}";
    let result = validate(&files("pnpm-lock.yaml", lock));
    assert!(result.is_ok(), "{result:?}");
}

#[test]
fn lockfile_values_use_position_context_not_matching_text() {
    for lock in [
        "importers:\n  packages/a/b:\n    dependencies:\n      ui:\n        specifier: file:../../x.tgz\n        version: file:../../x.tgz\npackages:\n  ui@1.0.0:\n    resolution: {tarball: 'file:../../x.tgz'}",
        "importers:\n  .: # root importer\n    dependencies:\n      ui:\n        specifier: link:../../../outside\n        version: link:../../../outside",
    ] {
        let files = BTreeMap::from([(
            RepoPath::parse("pnpm-lock.yaml").unwrap(),
            lock.as_bytes().to_vec(),
        )]);
        assert!(
            matches!(validate(&files), Err(Error::LocalOutside { .. })),
            "{lock}"
        );
    }
}

#[test]
fn classic_lockfile_patterns_resolve_from_the_lockfile_folder() {
    let lock =
        b"# yarn lockfile v1\n\"ui@file:../vendor/ui.tgz\":\n  resolved \"file:../vendor/ui.tgz\"";
    let result = super::manager_lockfiles::validate(lock, "yarn.lock");
    assert!(
        matches!(result, Err(Error::LocalOutside { .. })),
        "{result:?}"
    );
}

#[test]
fn descriptor_lists_and_url_text_cannot_hide_a_local_range() {
    for (path, lock) in [
        (
            "yarn.lock",
            "# yarn lockfile v1\n\"ui@file:../../outside.tgz#://\":\n  version \"1.0.0\"",
        ),
        (
            "yarn.lock",
            "__metadata: {version: 8}\n\"ui@npm:1.0.0, ui@file:../../outside.tgz::locator=root%40workspace%3A.\":\n  resolution: \"ui@npm:1.0.0\"",
        ),
    ] {
        assert!(
            matches!(
                validate(&files(path, lock)),
                Err(Error::LocalOutside { .. })
            ),
            "{path}: {lock}"
        );
    }
}

#[test]
fn classic_colon_delimited_keys_still_validate_quoted_paths() {
    let lock = "# yarn lockfile v1\nui@1.0.0:\n  resolved:\"file:../../outside.tgz#hash\"";
    assert!(matches!(
        validate(&files("yarn.lock", lock)),
        Err(Error::LocalOutside { .. })
    ));
}
