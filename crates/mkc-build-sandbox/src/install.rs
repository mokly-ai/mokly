//! Tracked lockfile precedence and exact package-manager install commands.

use std::collections::BTreeSet;

use async_trait::async_trait;
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_build_interface::request::BuildRequest;
use semver::Version;

use crate::command::{Command, REPO, args, directories, directory};
use crate::failure::Failure;
use crate::process::ProcessDriver;
use crate::session::require;

const LOCKFILES: &[&str] = &[
    "pnpm-lock.yaml",
    "yarn.lock",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "bun.lock",
    "bun.lockb",
];

#[async_trait]
pub(crate) trait Install: Send + Sync {
    async fn install(&self) -> Result<Option<String>, BuildOutcome>;
}

pub(crate) struct DependencyInstaller<'a> {
    pub(crate) request: &'a BuildRequest,
    pub(crate) process: &'a dyn ProcessDriver,
}

#[async_trait]
impl Install for DependencyInstaller<'_> {
    async fn install(&self) -> Result<Option<String>, BuildOutcome> {
        let step = BuildStep::Install;
        let candidates = directories(self.request.config_path.as_str());
        let mut argv = args(&["ls-files", "-z", "--"]);
        for parent in &candidates {
            argv.extend(LOCKFILES.iter().map(|lock| relative(parent, lock)));
        }
        let result = require(
            self.process
                .run(step, Command::new("git", argv, REPO).probe())
                .await?,
            step,
        )?;
        let tracked: BTreeSet<_> = result.stdout.split(|byte| *byte == 0).collect();
        for parent in candidates {
            let has = |lock: &str| tracked.contains(relative(&parent, lock).as_bytes());
            let cwd = directory(&parent);
            let command = if has("pnpm-lock.yaml") {
                Command::new(
                    "corepack",
                    args(&["pnpm", "install", "--frozen-lockfile"]),
                    &cwd,
                )
            } else if has("yarn.lock") {
                let version = require(
                    self.process
                        .run(
                            step,
                            Command::new("corepack", args(&["yarn", "--version"]), &cwd).probe(),
                        )
                        .await?,
                    step,
                )?;
                let version = str::from_utf8(&version.stdout)
                    .ok()
                    .and_then(|version| Version::parse(version.trim()).ok())
                    .ok_or_else(|| Failure::YarnVersion.outcome())?;
                let argv = if version.major == 1 {
                    args(&["yarn", "install", "--frozen-lockfile", "--non-interactive"])
                } else {
                    args(&["yarn", "install", "--immutable"])
                };
                Command::new("corepack", argv, &cwd)
            } else if has("package-lock.json") || has("npm-shrinkwrap.json") {
                Command::new("npm", args(&["ci", "--no-audit", "--no-fund"]), &cwd)
            } else if has("bun.lock") || has("bun.lockb") {
                return Err(BuildOutcome::UnsupportedLockfile);
            } else {
                continue;
            };
            require(self.process.run(step, command).await?, step)?;
            return Ok(Some(parent));
        }
        Ok(None)
    }
}

fn relative(parent: &str, file: &str) -> String {
    if parent.is_empty() {
        file.into()
    } else {
        format!("{parent}/{file}")
    }
}
