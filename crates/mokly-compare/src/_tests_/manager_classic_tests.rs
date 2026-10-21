//! Classic installs pin a confined committed or private mirror and folders.

use std::collections::BTreeMap;
use std::ffi::OsStr;
use std::path::Path;
use std::time::Duration;

use mokly_git::identity::RepoPath;

use crate::commands::Command;
use crate::error::Error;
use crate::inputs::Inputs;
use crate::manager_classic::Configuration;
use crate::manager_command::{same, variables};

fn inputs(config: &str) -> Inputs {
    Inputs {
        files: BTreeMap::from([(
            RepoPath::parse(".yarnrc").unwrap(),
            config.as_bytes().to_vec(),
        )]),
        objects: BTreeMap::new(),
    }
}

#[test]
fn classic_mirror_comes_from_the_nearest_confined_yarnrc_setting() {
    let base = inputs(
        "yarn-offline-mirror \"./offline\"\nyarn-path \"./historic.cjs\"\n--install.modules-folder \"../outside\"\n",
    );
    let config = Configuration::read(&base, "app").unwrap();
    assert_eq!(
        config
            .mirror()
            .map(|path| path.under(Path::new("/private"))),
        Some("/private/offline".into())
    );
    let mut base = base;
    base.files.insert(
        RepoPath::parse("app/.yarnrc").unwrap(),
        b"yarn-offline-mirror false".to_vec(),
    );
    assert!(
        Configuration::read(&base, "app")
            .unwrap()
            .mirror()
            .is_none()
    );
}

#[test]
fn classic_mirror_paths_obey_repository_confinement() {
    for value in ["../outside", "/outside", "~/outside", "C:/outside"] {
        let base = inputs(&format!("yarn-offline-mirror \"{value}\""));
        assert!(
            matches!(
                Configuration::read(&base, ""),
                Err(Error::LocalOutside { .. })
            ),
            "{value}"
        );
    }
    let base = inputs("'yarn-offline-mirror': './offline'");
    assert_eq!(
        Configuration::read(&base, "")
            .unwrap()
            .mirror()
            .map(|path| path.under(Path::new("/private"))),
        Some("/private/offline".into())
    );
}

#[test]
fn classic_pins_its_mirror_and_folders_against_every_inherited_spelling() {
    let request = Command {
        program: "yarn".into(),
        args: vec!["install".into(), "--frozen-lockfile".into()],
        directory: "/private".into(),
        timeout: Duration::from_secs(120),
        byte_limit: Some(1000),
        size_root: Some("/private".into()),
        cache: Some("/private/offline".into()),
    };
    let pinned = variables(&request);
    let pins = |inherited: &str| {
        pinned
            .iter()
            .any(|(name, _)| same(OsStr::new(inherited), name))
    };
    for name in [
        "YARN_YARN_OFFLINE_MIRROR",
        "yarn_yarn_offline_mirror",
        "npm_config_yarn_offline_mirror",
        "yarn_cache_folder",
        "YARN_OFFLINE_CACHE_FOLDER",
    ] {
        assert!(pins(name), "{name}");
    }
    for name in [
        "PATH",
        "NODE_OPTIONS",
        "HOME",
        "NPM_CONFIG_CACHE",
        "YARN_REGISTRY",
    ] {
        assert!(!pins(name), "{name}");
    }
    assert!(
        pinned
            .iter()
            .any(|(name, value)| *name == "YARN_YARN_OFFLINE_MIRROR" && value == "/private/offline")
    );
}
