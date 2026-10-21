//! Fixed install arguments and process settings for supported manager dialects.
//!
//! Installs may download from the registry that the base and user
//! configuration select, as npm does. Mokly still pins every cache, store,
//! mirror, and state folder inside the private entry, keeps scripts, hooks,
//! Git transports, and Corepack downloads off, and starts each install from
//! an allowed list of variables, so no base configuration can read an
//! inherited secret.

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
                "YARN_INJECT_ENVIRONMENT_FILES",
                no_environment_files(request),
            ),
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
        variables.push((
            "YARN_INJECT_ENVIRONMENT_FILES",
            no_environment_files(request),
        ));
    }
    variables
}

/// The single optional environment-file path that replaces Yarn Berry's own
/// list, so no base environment file is injected. The path sits above the
/// private entry, where a base cannot commit a file, and the trailing `?`
/// marks it optional, so Berry injects nothing.
fn no_environment_files(request: &Command) -> OsString {
    let anchor = request
        .size_root
        .as_deref()
        .and_then(Path::parent)
        .unwrap_or(&request.directory);
    let mut value = anchor.join(".mokly-no-environment-file").into_os_string();
    value.push("?");
    value
}

/// Whether an inherited variable is on the allowed list that every install
/// starts from. Mokly removes every other inherited variable, so a base
/// cannot read a secret such as `MOKLY_TOKEN`, `GITHUB_TOKEN`, or `NPM_TOKEN`
/// through its configuration. Mokly adds its own fixed names separately, with
/// the values that `variables` sets. This is the single rule for the install
/// environment. Windows reads a variable name without case, so the names
/// match without case there.
pub(crate) fn allowed(inherited: &OsStr) -> bool {
    const NAMES: &[&str] = &[
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
        "TZ",
        "USER",
        "LOGNAME",
        "SystemRoot",
        "windir",
        "ComSpec",
        "PATHEXT",
        "TEMP",
        "TMP",
        "USERPROFILE",
        "APPDATA",
        "LOCALAPPDATA",
        "HOMEDRIVE",
        "HOMEPATH",
        "NUMBER_OF_PROCESSORS",
        "PROCESSOR_ARCHITECTURE",
    ];
    let name = inherited.to_string_lossy();
    let matches = |listed: &str| {
        if cfg!(windows) {
            listed.eq_ignore_ascii_case(&name)
        } else {
            listed == name
        }
    };
    if NAMES.iter().any(|listed| matches(listed)) {
        return true;
    }
    // Every locale category, for example LC_CTYPE and LC_TIME.
    match name.get(..3) {
        Some(prefix) if cfg!(windows) => prefix.eq_ignore_ascii_case("LC_"),
        Some(prefix) => prefix == "LC_",
        None => false,
    }
}

fn fixed(values: &[(&'static str, &str)]) -> Vec<(&'static str, OsString)> {
    values
        .iter()
        .map(|(name, value)| (*name, OsString::from(value)))
        .collect()
}
