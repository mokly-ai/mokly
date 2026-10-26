//! The pinned package managers, their fixture installs, and the install probe.

use std::fs;
use std::os::unix::fs::{PermissionsExt, symlink};
use std::path::{Path, PathBuf};
use std::process::Command;

use mokly_test_support::files::write;
use mokly_test_support::workspace;
use regex::Regex;
use serde_json::json;

/// One pinned development package manager.
#[derive(Clone, Copy, Debug)]
pub(super) struct Manager {
    pub(super) name: &'static str,
    pub(super) package: &'static str,
    pub(super) version: &'static str,
    cli: &'static str,
}

/// pnpm 10, Yarn Classic, Yarn Berry, pnpm 11, and pnpm 12.
pub(super) const MANAGERS: [Manager; 5] = [
    Manager {
        name: "pnpm",
        package: "pnpm",
        version: "10.34.7",
        cli: "bin/pnpm.cjs",
    },
    Manager {
        name: "Yarn Classic",
        package: "yarn",
        version: "1.22.22",
        cli: "bin/yarn.js",
    },
    Manager {
        name: "Yarn Berry",
        package: "@yarnpkg/cli-dist",
        version: "4.18.1",
        cli: "bin/yarn.js",
    },
    Manager {
        name: "pnpm 11",
        package: "pnpm-modern",
        version: "11.20.0",
        cli: "bin/pnpm.mjs",
    },
    Manager {
        name: "pnpm 12",
        package: "pnpm-native",
        version: "12.14.0",
        cli: "bin/pnpm.mjs",
    },
];

impl Manager {
    /// The command name: `pnpm` or `yarn`.
    pub(super) fn command(&self) -> &'static str {
        if self.name.starts_with("pnpm") {
            "pnpm"
        } else {
            "yarn"
        }
    }

    fn directory(&self) -> PathBuf {
        workspace::root().join("node_modules").join(self.package)
    }

    /// The pinned CLI script, which runs with the current Node.
    pub(super) fn cli(&self) -> PathBuf {
        self.directory().join(self.cli)
    }

    /// Install the fixture in `root` offline and without scripts.
    pub(super) fn install(&self, root: &Path, env: &[(String, String)]) {
        let store = root.join(".context/store");
        let yarn_cache = root.join(".context/yarn-cache");
        let args: Vec<String> = if self.command() == "pnpm" {
            [
                "install",
                "--no-frozen-lockfile",
                "--offline",
                "--ignore-scripts",
                "--ignore-pnpmfile",
                "--config.pm-on-fail=ignore",
                "--config.manage-package-manager-versions=false",
                "--store-dir",
            ]
            .iter()
            .map(|arg| (*arg).to_owned())
            .chain([store.display().to_string()])
            .collect()
        } else if self.name == "Yarn Classic" {
            [
                "install",
                "--offline",
                "--ignore-scripts",
                "--non-interactive",
                "--cache-folder",
            ]
            .iter()
            .map(|arg| (*arg).to_owned())
            .chain([yarn_cache.display().to_string()])
            .collect()
        } else {
            vec!["install".to_owned(), "--mode=skip-build".to_owned()]
        };
        let home = root.join(".context/manager-home");
        self.run(
            root,
            &args,
            env,
            &[
                ("HOME", home.display().to_string()),
                ("YARN_ENABLE_NETWORK", "false".to_owned()),
            ],
            &[],
        );
    }

    /// Run the CLI with `args` in `root`, the fixture environment, and `extra`
    /// variables, without the inherited variables in `remove`.
    pub(super) fn run(
        &self,
        root: &Path,
        args: &[String],
        env: &[(String, String)],
        extra: &[(&str, String)],
        remove: &[String],
    ) {
        let home = root.join(".context/manager-home");
        let mut command = Command::new("node");
        for name in remove {
            command.env_remove(name);
        }
        let output = command
            .current_dir(root)
            .arg(self.cli())
            .args(args)
            .envs(
                env.iter()
                    .map(|(name, value)| (name.as_str(), value.as_str())),
            )
            .env("LOCALAPPDATA", &home)
            .env("XDG_CACHE_HOME", &home)
            .env("YARN_ENABLE_IMMUTABLE_INSTALLS", "false")
            .env("YARN_ENABLE_TELEMETRY", "false")
            .envs(extra.iter().map(|(name, value)| (*name, value.as_str())))
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{} {}: {}{}",
            self.name,
            args.join(" "),
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }

    /// A `PATH` whose `bin` folder beside `root` holds a probing `node` and,
    /// unless `missing`, this manager. Other folders with a manager are left out.
    pub(super) fn path(&self, root: &Path, missing: bool) -> String {
        let bin = root.parent().unwrap().join("bin");
        fs::create_dir_all(&bin).unwrap();
        let preload = root.join(".context/manager-probe.cjs");
        let real = String::from_utf8(
            Command::new("node")
                .args(["-p", "process.execPath"])
                .output()
                .unwrap()
                .stdout,
        )
        .unwrap();
        let real = json!(real.trim());
        let preload = json!(preload.display().to_string());
        executable(
            &bin.join("node"),
            &format!(
                "#!/bin/sh\nif [ -f {preload} ]; then exec {real} --require {preload} \"$@\"; fi\nexec {real} \"$@\"\n"
            ),
        );
        if !missing {
            let link = bin.join(self.command());
            if self.package == "pnpm-native" {
                let url = format!("file://{}", self.cli().display());
                executable(
                    &link,
                    &format!("#!/usr/bin/env node\nvoid import({});\n", json!(url)),
                );
            } else {
                symlink(self.cli(), link).unwrap();
            }
        }
        let original = std::env::var("PATH").unwrap_or_default();
        let manager = Regex::new(r"(?i)^(pnpm|yarn|corepack)(\.(cmd|exe|bat|com))?$").unwrap();
        let mut safe = vec![bin.display().to_string()];
        for directory in original.split(':') {
            if !Path::new(directory).is_absolute() {
                continue;
            }
            let has_manager = fs::read_dir(directory).is_ok_and(|entries| {
                entries
                    .flatten()
                    .any(|entry| manager.is_match(&entry.file_name().to_string_lossy()))
            });
            if !has_manager {
                safe.push(directory.to_owned());
            }
        }
        safe.join(":")
    }
}

fn executable(path: &Path, text: &str) {
    write(
        path.parent().unwrap(),
        path.file_name().unwrap().to_str().unwrap(),
        text,
    );
    fs::set_permissions(path, fs::Permissions::from_mode(0o755)).unwrap();
}
