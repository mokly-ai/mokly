//! Fixed install arguments and process settings for supported manager dialects.
//!
//! Installs may download from the registry that the base and user
//! configuration select, as npm does. Mokly still pins every cache, store,
//! mirror, and state folder inside the private entry, keeps scripts, hooks,
//! Git transports, and Corepack downloads off, and gives every variable it
//! sets precedence over each inherited spelling of the same name.

use std::ffi::{OsStr, OsString};
use std::path::Path;

use crate::commands::Command;
use crate::manager::{Manager, Root};

pub(crate) fn arguments(root: &Root, destination: &Path) -> Vec<OsString> {
    let directory = destination.join(&root.directory);
    let flags: &[&str] = match root.manager {
        Manager::Npm => &["ci", "--ignore-scripts", "--no-audit", "--no-fund"],
        Manager::Pnpm => &[
            "install",
            "--frozen-lockfile",
            "--ignore-scripts",
            "--ignore-pnpmfile",
            "--config.pm-on-fail=ignore",
            "--config.global=false",
            "--config.use-store-server=false",
            "--config.use-running-store-server=false",
            "--config.manage-package-manager-versions=false",
            "--config.package-manager-strict-version=false",
            "--config.package-import-method=copy",
            "--config.enable-global-virtual-store=false",
            "--config.side-effects-cache=false",
            "--config.use-node-version=",
            "--config.update-notifier=false",
        ],
        Manager::YarnClassic => &[
            "install",
            "--frozen-lockfile",
            "--ignore-scripts",
            "--non-interactive",
            "--no-progress",
        ],
        Manager::YarnBerry => &["install", "--immutable", "--mode=skip-build"],
    };
    let mut args = flags.iter().map(OsString::from).collect::<Vec<_>>();
    let paths: &[(&str, &str)] = match root.manager {
        Manager::Npm => &[
            ("--cache", ".npm-cache"),
            ("--logs-dir", ".npm-cache/_logs"),
            ("--prefix", ""),
        ],
        Manager::Pnpm => &[
            ("--store-dir", ".pnpm-store"),
            ("--config.cache-dir", ".pnpm-cache"),
            ("--config.state-dir", ".pnpm-state"),
            ("--config.virtual-store-dir", "node_modules/.pnpm"),
            ("--config.modules-dir", "node_modules"),
            ("--dir", ""),
            ("--lockfile-dir", ""),
        ],
        Manager::YarnClassic => &[
            ("--cwd", ""),
            ("--cache-folder", ".yarn-cache"),
            ("--modules-folder", "node_modules"),
            ("--global-folder", ".yarn-global"),
            ("--link-folder", ".yarn-links"),
        ],
        Manager::YarnBerry => &[],
    };
    for (flag, path) in paths {
        if root.manager == Manager::Pnpm {
            let mut argument = OsString::from(flag);
            argument.push("=");
            if *flag == "--config.modules-dir" {
                argument.push(path);
            } else {
                argument.push(directory.join(path));
            }
            args.push(argument);
        } else {
            args.push(flag.into());
            let cache_root = if root.manager == Manager::Npm && *flag != "--prefix" {
                destination
            } else {
                &directory
            };
            args.push(cache_root.join(path).into_os_string());
        }
    }
    if root.manager == Manager::YarnClassic {
        let mut mutex = OsString::from("file:");
        mutex.push(directory.join(".yarn-mutex"));
        args.extend([OsString::from("--mutex"), mutex]);
    }
    args
}

pub(crate) fn caches(manager: Manager) -> &'static [&'static str] {
    match manager {
        Manager::Npm => &[".npm-cache"],
        Manager::Pnpm => &[".pnpm-store", ".pnpm-cache", ".pnpm-state"],
        Manager::YarnClassic => &[
            ".yarn-cache",
            ".yarn-global",
            ".yarn-links",
            ".yarn-offline-cache",
            ".yarn-mutex.lock",
        ],
        Manager::YarnBerry => &[".yarn/cache", ".yarn/global"],
    }
}

/// Variables that the install receives. Each replaces every inherited
/// spelling of its name.
pub(crate) fn variables(request: &Command) -> Vec<(&'static str, OsString)> {
    let mut variables = fixed(&[
        ("npm_config_ignore_scripts", "true"),
        ("npm_config_audit", "false"),
        ("npm_config_fund", "false"),
        ("npm_config_update_notifier", "false"),
    ]);
    if request.program != "pnpm" && request.program != "yarn" {
        return variables;
    }
    variables.extend(fixed(&[
        ("COREPACK_ENABLE_NETWORK", "0"),
        ("COREPACK_DEFAULT_TO_LATEST", "0"),
        ("COREPACK_ENABLE_AUTO_PIN", "0"),
        ("COREPACK_ENV_FILE", "0"),
        ("COREPACK_ENABLE_DOWNLOAD_PROMPT", "0"),
        ("GIT_ALLOW_PROTOCOL", ""),
        ("npm_config_manage_package_manager_versions", "false"),
        ("npm_config_ignore_pnpmfile", "true"),
        ("pnpm_config_ignore_pnpmfile", "true"),
        ("pnpm_config_pm_on_fail", "ignore"),
    ]));
    if request.program != "yarn" {
        return variables;
    }
    variables.extend(fixed(&[
        ("YARN_IGNORE_PATH", "1"),
        ("YARN_ENABLE_TELEMETRY", "0"),
    ]));
    let directory = &request.directory;
    if request.args.iter().any(|arg| arg == "--immutable") {
        variables.extend(fixed(&[
            ("YARN_RC_FILENAME", ".yarnrc.yml"),
            ("YARN_ENABLE_CONSTRAINTS_CHECKS", "0"),
            ("YARN_ENABLE_SCRIPTS", "0"),
            ("YARN_ENABLE_GLOBAL_CACHE", "0"),
            ("YARN_ENABLE_MIRROR", "0"),
            ("YARN_ENABLE_HARDENED_MODE", "0"),
            ("YARN_NODE_LINKER", "node-modules"),
            ("YARN_NM_MODE", "classic"),
        ]));
        let cache = request.cache.clone();
        variables.extend([
            (
                "YARN_CACHE_FOLDER",
                cache
                    .unwrap_or_else(|| directory.join(".yarn/cache"))
                    .into_os_string(),
            ),
            ("YARN_GLOBAL_FOLDER", directory.join(".yarn/global").into()),
            (
                "YARN_INSTALL_STATE_PATH",
                directory.join(".yarn/install-state.gz").into(),
            ),
        ]);
    } else if request.args.iter().any(|arg| arg == "--frozen-lockfile") {
        let mirror = request
            .cache
            .clone()
            .unwrap_or_else(|| directory.join(".yarn-mirror"));
        variables.extend([
            ("YARN_YARN_OFFLINE_MIRROR", mirror.clone().into_os_string()),
            ("npm_config_yarn_offline_mirror", mirror.into_os_string()),
            ("YARN_YARN_OFFLINE_MIRROR_PRUNING", "false".into()),
            ("YARN_CACHE_FOLDER", directory.join(".yarn-cache").into()),
            ("YARN_GLOBAL_FOLDER", directory.join(".yarn-global").into()),
            (
                "YARN_OFFLINE_CACHE_FOLDER",
                directory.join(".yarn-offline-cache").into(),
            ),
            ("YARN_DISABLE_SELF_UPDATE_CHECK", "true".into()),
        ]);
    } else if request.args == ["--version"] {
        variables.extend(fixed(&[("YARN_RC_FILENAME", ".mokly-unused-yarnrc.yml")]));
    }
    variables
}

/// Inherited variables that the install never receives.
pub(crate) fn removed(request: &Command) -> &'static [&'static str] {
    if request.program == "yarn" {
        &["YARN_PLUGINS"]
    } else {
        &[]
    }
}

/// Whether an inherited name spells `name`. Managers read variable names
/// without case, and Yarn reads a dash as an underscore.
pub(crate) fn same(inherited: &OsStr, name: &str) -> bool {
    let spelling = |value: &str| value.to_ascii_lowercase().replace('-', "_");
    spelling(&inherited.to_string_lossy()) == spelling(name)
}

fn fixed(values: &[(&'static str, &str)]) -> Vec<(&'static str, OsString)> {
    values
        .iter()
        .map(|(name, value)| (*name, OsString::from(value)))
        .collect()
}
