//! Classic installations use only confined committed mirror settings.

use std::collections::BTreeMap;
use std::ffi::OsStr;
use std::path::Path;
use std::time::Duration;

use mokly_git::identity::RepoPath;

use crate::commands::Command;
use crate::error::Error;
use crate::inputs::Inputs;
use crate::manager_classic::Configuration;
use crate::manager_command::external_classic_setting;

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
fn classic_private_configuration_keeps_the_ancestor_mirror_and_drops_other_settings() {
    let base = inputs(
        "yarn-offline-mirror \"./offline\"\nyarn-path \"./historic.cjs\"\n--install.modules-folder \"../outside\"\n",
    );
    let config = Configuration::read(&base, "app").unwrap();
    let content = String::from_utf8(config.contents(Path::new("/private")).unwrap()).unwrap();
    assert_eq!(
        content,
        "yarn-offline-mirror \"/private/offline\"\nyarn-offline-mirror-pruning false\n"
    );
    let mut base = base;
    base.files.insert(
        RepoPath::parse("app/.yarnrc").unwrap(),
        b"yarn-offline-mirror false".to_vec(),
    );
    let content = Configuration::read(&base, "app")
        .unwrap()
        .contents(Path::new("/private"))
        .unwrap();
    assert_eq!(
        content,
        b"yarn-offline-mirror false\nyarn-offline-mirror-pruning false\n"
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
    assert!(
        Configuration::read(&base, "")
            .unwrap()
            .contents(Path::new("/private"))
            .unwrap()
            .starts_with(b"yarn-offline-mirror \"/private/offline\"")
    );
}

#[test]
fn classic_external_environment_cannot_replace_the_private_configuration() {
    let request = Command {
        program: "yarn".into(),
        args: vec![
            "install".into(),
            "--use-yarnrc".into(),
            "/private/.yarnrc".into(),
        ],
        directory: "/private".into(),
        timeout: Duration::from_secs(120),
        byte_limit: Some(1000),
        size_root: Some("/private".into()),
        berry_cache: None,
    };
    for name in [
        "YARN_YARN_OFFLINE_MIRROR",
        "yarn_yarn_offline_mirror",
        "npm_config_yarn_offline_mirror",
        "NPM_CONFIG_CACHE",
    ] {
        assert!(
            external_classic_setting(&request, OsStr::new(name)),
            "{name}"
        );
    }
    for name in ["PATH", "NODE_OPTIONS", "HOME"] {
        assert!(
            !external_classic_setting(&request, OsStr::new(name)),
            "{name}"
        );
    }
}
