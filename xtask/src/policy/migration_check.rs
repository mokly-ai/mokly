//! Compare the cloud migration lock with the fetched base and SQL files.

use std::path::Path;
use std::sync::Arc;

use crate::command::CommandSpec;
use crate::error::{Result, reject};

use super::environment::{Environment, text};
use super::migrations;

pub(super) struct MigrationCheck {
    pub(super) environment: Arc<dyn Environment>,
}

impl MigrationCheck {
    pub(super) fn check(&self) -> Result<()> {
        let lock_path = "crates/mkc-db/migration-lock.txt";
        let tracked = self.environment.output(&CommandSpec::new("git").args([
            "ls-tree",
            "--name-only",
            "origin/main",
            "--",
            lock_path,
        ]))?;
        let baseline = if tracked.trim().is_empty() {
            String::new()
        } else {
            self.environment.output(
                &CommandSpec::new("git").args(["show", &format!("origin/main:{lock_path}")]),
            )?
        };
        let lock = text(self.environment.as_ref(), lock_path)?;
        let mut files = Vec::new();
        for path in self.environment.files()? {
            if path.starts_with(Path::new("crates/mkc-db/migrations")) {
                files.push((path.clone(), self.environment.read(&path)?));
            }
        }
        reject(migrations::validate(&lock, &baseline, &files))
    }
}
