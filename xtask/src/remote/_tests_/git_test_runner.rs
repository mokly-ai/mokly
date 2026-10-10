//! Git fixture setup and inspection without developer global or system config.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::child_environment::{GIT_REPOSITORY_VARIABLES, SECRET_VARIABLES};

/// One fixture's Git command host; production requests keep their real environment.
pub(crate) struct IsolatedGit {
    /// Empty global configuration owned by this fixture's temporary directory.
    global_config: PathBuf,
}

impl IsolatedGit {
    /// Create an empty config file on every supported platform.
    pub(crate) fn new(temporary: &Path) -> Self {
        let global_config = temporary.join("empty-global.gitconfig");
        fs::write(&global_config, []).unwrap();
        Self { global_config }
    }

    /// Run setup or inspection with separate arguments and a clean Git environment.
    pub(crate) fn run(&self, cwd: &Path, args: &[&str]) -> String {
        let mut command = Command::new("git");
        command.args(args).current_dir(cwd);
        for name in GIT_REPOSITORY_VARIABLES.iter().chain(SECRET_VARIABLES) {
            command.env_remove(name);
        }
        command
            .env("GIT_CONFIG_GLOBAL", &self.global_config)
            .env("GIT_CONFIG_NOSYSTEM", "1");
        let output = command.output().unwrap();
        assert!(
            output.status.success(),
            "{args:?}: {}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8(output.stdout).unwrap()
    }
}
