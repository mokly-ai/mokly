//! Captured install inputs allow registry access and keep private storage.

use std::collections::BTreeMap;
use std::ffi::{OsStr, OsString};
use std::path::Path;
use std::time::Duration;

use crate::commands::Command;
use crate::manager::{Manager, Root};
use crate::manager_command::{arguments, removed, same, variables};

fn request(manager: Manager, args: Vec<OsString>) -> Command {
    Command {
        program: manager.program().into(),
        args,
        directory: "/private/frontend".into(),
        timeout: Duration::from_secs(10),
        byte_limit: Some(1000),
        size_root: Some("/private".into()),
        cache: None,
    }
}

#[test]
fn manager_installs_allow_registry_access_and_keep_scripts_and_storage_private() {
    for manager in [
        Manager::Npm,
        Manager::Pnpm,
        Manager::YarnClassic,
        Manager::YarnBerry,
    ] {
        let root = Root {
            directory: "frontend".into(),
            manager,
            requested: None,
            version: String::new(),
            classic: None,
            berry_cache: None,
        };
        let args = arguments(&root, Path::new("/private"));
        for flag in ["--offline", "--no-default-rc", "--use-yarnrc"] {
            assert!(!args.iter().any(|arg| arg == flag), "{manager:?} {flag}");
        }
        match manager {
            Manager::Npm => assert!(args.iter().any(|arg| arg == "--ignore-scripts")),
            Manager::YarnBerry => {
                assert!(args.iter().any(|arg| arg == "--mode=skip-build"));
                assert!(args.iter().any(|arg| arg == "--immutable"));
            }
            Manager::Pnpm | Manager::YarnClassic => {
                for flag in ["--frozen-lockfile", "--ignore-scripts"] {
                    assert!(args.iter().any(|arg| arg == flag), "{manager:?} {flag}");
                }
                assert!(
                    args.iter()
                        .filter(|arg| Path::new(arg).is_absolute())
                        .all(|arg| Path::new(arg).starts_with("/private/frontend"))
                );
            }
        }
        if manager == Manager::Pnpm {
            assert!(
                args.iter()
                    .any(|arg| arg == "--config.modules-dir=node_modules")
            );
            assert!(
                args.iter()
                    .any(|arg| arg == "--store-dir=/private/frontend/.pnpm-store")
            );
        }
        if manager == Manager::YarnClassic {
            let after = |flag: &str| {
                let index = args.iter().position(|arg| arg == flag).unwrap();
                args[index + 1].clone()
            };
            assert!(Path::new(&after("--cwd")).starts_with("/private/frontend"));
            assert_eq!(after("--mutex"), "file:/private/frontend/.yarn-mutex");
        }
        let captured = variables(&request(manager, args))
            .into_iter()
            .collect::<BTreeMap<_, _>>();
        assert_eq!(captured["npm_config_ignore_scripts"], "true");
        for name in ["npm_config_offline", "YARN_ENABLE_NETWORK"] {
            assert!(!captured.contains_key(name), "{manager:?} {name}");
        }
        if manager == Manager::Npm {
            assert_eq!(captured.len(), 4);
            continue;
        }
        assert_eq!(captured["GIT_ALLOW_PROTOCOL"], "");
        for name in [
            "COREPACK_ENABLE_NETWORK",
            "COREPACK_ENABLE_AUTO_PIN",
            "COREPACK_DEFAULT_TO_LATEST",
            "COREPACK_ENV_FILE",
        ] {
            assert_eq!(captured[name], "0");
        }
        let private = |name: &str| {
            assert!(
                Path::new(&captured[name]).starts_with("/private/frontend"),
                "{manager:?} {name}"
            );
        };
        if manager == Manager::YarnBerry {
            for name in [
                "YARN_ENABLE_CONSTRAINTS_CHECKS",
                "YARN_ENABLE_SCRIPTS",
                "YARN_ENABLE_TELEMETRY",
                "YARN_ENABLE_MIRROR",
                "YARN_ENABLE_GLOBAL_CACHE",
            ] {
                assert_eq!(captured[name], "0");
            }
            for name in [
                "YARN_CACHE_FOLDER",
                "YARN_GLOBAL_FOLDER",
                "YARN_INSTALL_STATE_PATH",
            ] {
                private(name);
            }
        }
        if manager == Manager::YarnClassic {
            for name in [
                "YARN_YARN_OFFLINE_MIRROR",
                "npm_config_yarn_offline_mirror",
                "YARN_CACHE_FOLDER",
                "YARN_GLOBAL_FOLDER",
                "YARN_OFFLINE_CACHE_FOLDER",
            ] {
                private(name);
            }
            assert_eq!(captured["YARN_YARN_OFFLINE_MIRROR_PRUNING"], "false");
            assert_eq!(captured["YARN_DISABLE_SELF_UPDATE_CHECK"], "true");
        }
    }
}

#[test]
fn pinned_variables_replace_every_inherited_spelling_and_keep_user_settings() {
    for (inherited, name) in [
        ("yarn_yarn_offline_mirror", "YARN_YARN_OFFLINE_MIRROR"),
        ("YARN_yarn-offline-mirror", "YARN_YARN_OFFLINE_MIRROR"),
        ("yarn_enable_scripts", "YARN_ENABLE_SCRIPTS"),
        ("NPM_CONFIG_IGNORE_SCRIPTS", "npm_config_ignore_scripts"),
    ] {
        assert!(same(OsStr::new(inherited), name), "{inherited}");
    }
    for inherited in ["NPM_CONFIG_REGISTRY", "YARN_REGISTRY", "PATH", "HOME"] {
        assert!(
            !variables(&request(
                Manager::YarnClassic,
                vec!["--frozen-lockfile".into()]
            ))
            .iter()
            .any(|(name, _)| same(OsStr::new(inherited), name)),
            "{inherited}"
        );
    }
    assert_eq!(
        removed(&request(Manager::YarnBerry, vec![])),
        ["YARN_PLUGINS"]
    );
    assert!(removed(&request(Manager::Pnpm, vec![])).is_empty());
}
