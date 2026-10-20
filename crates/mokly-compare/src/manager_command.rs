//! Fixed install arguments and process settings for supported manager dialects.

use std::ffi::OsString;
use std::path::Path;
use std::process;

use crate::commands::Command;
use crate::manager::{Manager, Root};

pub(crate) fn arguments(root: &Root, destination: &Path) -> Vec<OsString> {
    let directory = destination.join(&root.directory);
    let flags: &[&str] = match root.manager {
        Manager::Npm => &["ci", "--ignore-scripts", "--no-audit", "--no-fund"],
        Manager::Pnpm => &[
            "install",
            "--offline",
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
            "--offline",
            "--frozen-lockfile",
            "--ignore-scripts",
            "--non-interactive",
            "--no-progress",
            "--no-default-rc",
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
    args
}

pub(crate) fn caches(manager: Manager) -> &'static [&'static str] {
    match manager {
        Manager::Npm => &[".npm-cache"],
        Manager::Pnpm => &[".pnpm-store", ".pnpm-cache", ".pnpm-state"],
        Manager::YarnClassic => &[".yarn-cache", ".yarn-global", ".yarn-links"],
        Manager::YarnBerry => &[".yarn/cache", ".yarn/global"],
    }
}

pub(crate) fn environment(request: &Command, command: &mut process::Command) {
    if request.program != "pnpm" && request.program != "yarn" {
        return;
    }
    command
        .env("COREPACK_ENABLE_NETWORK", "0")
        .env("COREPACK_DEFAULT_TO_LATEST", "0")
        .env("COREPACK_ENABLE_AUTO_PIN", "0")
        .env("COREPACK_ENV_FILE", "0")
        .env("COREPACK_ENABLE_DOWNLOAD_PROMPT", "0")
        .env("GIT_ALLOW_PROTOCOL", "")
        .env("npm_config_manage_package_manager_versions", "false")
        .env("npm_config_ignore_pnpmfile", "true")
        .env("pnpm_config_ignore_pnpmfile", "true")
        .env("pnpm_config_pm_on_fail", "ignore")
        .env("npm_config_update_notifier", "false")
        .env("npm_config_offline", "true");
    if request.program == "yarn" {
        command
            .env("YARN_IGNORE_PATH", "1")
            .env("YARN_ENABLE_NETWORK", "0")
            .env("YARN_ENABLE_TELEMETRY", "0")
            .env_remove("YARN_PLUGINS");
        if request.args.iter().any(|arg| arg == "--immutable") {
            command
                .env("YARN_RC_FILENAME", ".yarnrc.yml")
                .env("YARN_ENABLE_NETWORK", "0")
                .env("YARN_ENABLE_TELEMETRY", "0")
                .env("YARN_ENABLE_SCRIPTS", "0")
                .env("YARN_ENABLE_GLOBAL_CACHE", "0")
                .env("YARN_ENABLE_MIRROR", "0")
                .env("YARN_ENABLE_HARDENED_MODE", "0")
                .env("YARN_NODE_LINKER", "node-modules")
                .env("YARN_NM_MODE", "classic")
                .env("YARN_CACHE_FOLDER", request.directory.join(".yarn/cache"))
                .env("YARN_GLOBAL_FOLDER", request.directory.join(".yarn/global"))
                .env(
                    "YARN_INSTALL_STATE_PATH",
                    request.directory.join(".yarn/install-state.gz"),
                );
        } else if request.args == ["--version"] {
            command.env("YARN_RC_FILENAME", ".mokly-unused-yarnrc.yml");
        }
    }
}
