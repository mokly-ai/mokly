//! Scripts-off invocations retain the exact pre-opt-in argument order.

use std::ffi::OsString;
use std::path::Path;

use crate::manager::{Manager, Root};
use crate::manager_command::arguments;

#[test]
fn scripts_off_manager_arguments_keep_the_original_order() {
    let private = Path::new("private");
    let directory = private.join("frontend");
    let path = |value: &str| directory.join(value).into_os_string();
    let option = |name: &str, value: &str| {
        let mut result = OsString::from(name);
        result.push(directory.join(value));
        result
    };
    for (manager, expected) in [
        (
            Manager::Npm,
            vec![
                "ci".into(),
                "--ignore-scripts".into(),
                "--no-audit".into(),
                "--no-fund".into(),
                "--cache".into(),
                private.join(".npm-cache").into(),
                "--logs-dir".into(),
                private.join(".npm-cache/_logs").into(),
                "--prefix".into(),
                path(""),
            ],
        ),
        (
            Manager::Pnpm,
            vec![
                "install".into(),
                "--frozen-lockfile".into(),
                "--ignore-scripts".into(),
                "--ignore-pnpmfile".into(),
                "--config.pm-on-fail=ignore".into(),
                "--config.global=false".into(),
                "--config.use-store-server=false".into(),
                "--config.use-running-store-server=false".into(),
                "--config.manage-package-manager-versions=false".into(),
                "--config.package-manager-strict-version=false".into(),
                "--config.package-import-method=copy".into(),
                "--config.enable-global-virtual-store=false".into(),
                "--config.side-effects-cache=false".into(),
                "--config.use-node-version=".into(),
                "--config.update-notifier=false".into(),
                option("--store-dir=", ".pnpm-store"),
                option("--config.cache-dir=", ".pnpm-cache"),
                option("--config.state-dir=", ".pnpm-state"),
                option("--config.virtual-store-dir=", "node_modules/.pnpm"),
                "--config.modules-dir=node_modules".into(),
                option("--dir=", ""),
                option("--lockfile-dir=", ""),
            ],
        ),
        (
            Manager::YarnClassic,
            vec![
                "install".into(),
                "--frozen-lockfile".into(),
                "--ignore-scripts".into(),
                "--non-interactive".into(),
                "--no-progress".into(),
                "--cwd".into(),
                path(""),
                "--cache-folder".into(),
                path(".yarn-cache"),
                "--modules-folder".into(),
                path("node_modules"),
                "--global-folder".into(),
                path(".yarn-global"),
                "--link-folder".into(),
                path(".yarn-links"),
                "--mutex".into(),
                option("file:", ".yarn-mutex"),
            ],
        ),
        (
            Manager::YarnBerry,
            vec![
                "install".into(),
                "--immutable".into(),
                "--mode=skip-build".into(),
            ],
        ),
    ] {
        let root = Root {
            directory: "frontend".into(),
            manager,
            requested: None,
            version: String::new(),
            classic: None,
            berry_cache: None,
        };
        assert_eq!(arguments(&root, private, false), expected, "{manager:?}");
        let enabled = expected
            .into_iter()
            .filter(|arg| arg != "--ignore-scripts" && arg != "--mode=skip-build")
            .collect::<Vec<_>>();
        assert_eq!(arguments(&root, private, true), enabled, "{manager:?}");
    }
}
