//! Captured install inputs allow registry access and keep private storage.

use std::collections::BTreeMap;
use std::ffi::{OsStr, OsString};
use std::path::Path;
use std::time::Duration;

use crate::commands::Command;
use crate::manager::{Manager, Root};
use crate::manager_command::{allowed, arguments, variables};

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
        let args = arguments(&root, Path::new("/private"), false);
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
fn scripts_on_install_commands_omit_only_script_suppression_flags() {
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
        let args = arguments(&root, Path::new("/private"), true);
        assert!(
            !args.iter().any(|arg| arg == "--ignore-scripts"),
            "{manager:?}"
        );
        assert!(
            !args.iter().any(|arg| arg == "--mode=skip-build"),
            "{manager:?}"
        );
        let captured = variables(&request(manager, args))
            .into_iter()
            .collect::<BTreeMap<_, _>>();
        assert!(
            !captured.contains_key("npm_config_ignore_scripts"),
            "{manager:?}"
        );
        assert!(!captured.contains_key("YARN_ENABLE_SCRIPTS"), "{manager:?}");
    }
}

#[test]
fn install_environment_is_an_allowed_list_without_secrets() {
    // Mokly's own variables, every inherited token, and each manager setting
    // are not on the list, so a base cannot read one through its config.
    for name in [
        "MOKLY_TOKEN",
        "MOKLY_BASE",
        "GITHUB_TOKEN",
        "NODE_AUTH_TOKEN",
        "NPM_TOKEN",
        "NPM_CONFIG_USERCONFIG",
        "npm_config_registry",
        "YARN_NPM_AUTH_TOKEN",
        "YARN_PLUGINS",
        "YARN_ENABLE_SCRIPTS",
        "npm_config_ignore_scripts",
        "PNPM_HOME",
        "AWS_SECRET_ACCESS_KEY",
    ] {
        assert!(!allowed(OsStr::new(name)), "{name}");
    }
    // The list carries no secret: paths, proxies, certificates, and locale.
    for name in [
        "PATH",
        "HOME",
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "NO_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "no_proxy",
        "all_proxy",
        "NODE_EXTRA_CA_CERTS",
        "SSL_CERT_FILE",
        "SSL_CERT_DIR",
        "TMPDIR",
        "LANG",
        "LC_ALL",
        "LC_CTYPE",
        "TZ",
        "USER",
        "LOGNAME",
    ] {
        assert!(allowed(OsStr::new(name)), "{name}");
    }
    // Mokly never sets a registry or a user path as a fixed value either.
    let captured = variables(&request(
        Manager::YarnClassic,
        vec!["--frozen-lockfile".into()],
    ));
    for name in ["NPM_CONFIG_REGISTRY", "YARN_REGISTRY", "PATH", "HOME"] {
        assert!(!captured.iter().any(|(set, _)| *set == name), "{name}");
    }
}

#[test]
fn allowed_matches_case_insensitively_on_windows_only() {
    for name in ["systemroot", "Path", "LocalAppData", "lc_ctype"] {
        assert_eq!(allowed(OsStr::new(name)), cfg!(windows), "{name}");
    }
}

#[test]
fn berry_install_disables_base_environment_files() {
    let mut command = request(Manager::YarnBerry, vec!["--immutable".into()]);
    command.size_root = Some("/ns/dependencies/entries/key".into());
    let captured = variables(&command).into_iter().collect::<BTreeMap<_, _>>();
    // The override points above the private entry, where a base cannot commit
    // a file, and the `?` marks it optional, so Berry injects no file.
    assert_eq!(
        captured["YARN_INJECT_ENVIRONMENT_FILES"],
        OsString::from("/ns/dependencies/entries/.mokly-no-environment-file?")
    );
}
