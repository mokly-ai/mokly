//! Injected Git-visible file and captured process boundaries for policy checks.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::command::{CommandRunner, CommandSpec};
use crate::error::{ErrorResultExt, Result};

/// Files and processes used by policies; unit tests replace this boundary.
#[cfg_attr(test, unimock::unimock(api = [ReadMock, WriteMock, FilesMock, OutputMock, ReportMock]))]
pub(crate) trait Environment: Send + Sync {
    /// Read a repository-relative file.
    fn read(&self, path: &Path) -> Result<Vec<u8>>;
    /// Write a generated repository-relative artifact.
    fn write(&self, path: &Path, bytes: &[u8]) -> Result<()>;
    /// List existing tracked and non-ignored untracked files.
    fn files(&self) -> Result<Vec<PathBuf>>;
    /// Capture successful stdout at the workspace root.
    fn output(&self, command: &CommandSpec) -> Result<String>;
    /// Print developer-facing results.
    fn report(&self, message: &str);
}

/// Operating-system file adapter over the existing subprocess runner.
pub(crate) struct SystemEnvironment {
    /// Repository root.
    pub(crate) root: PathBuf,
    /// Shared command runner and child-environment policy.
    pub(crate) commands: Arc<dyn CommandRunner>,
}

impl Environment for SystemEnvironment {
    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        fs::read(self.root.join(path)).with_context(|| format!("read {}", path.display()))
    }

    fn write(&self, path: &Path, bytes: &[u8]) -> Result<()> {
        let path = self.root.join(path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).context("create generated directory")?;
        }
        fs::write(path, bytes).context("write generated artifact")
    }

    fn files(&self) -> Result<Vec<PathBuf>> {
        let output = self.output(&CommandSpec::new("git").args([
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "-z",
        ]))?;
        let mut paths = Vec::new();
        for path in output.split('\0').filter(|path| !path.is_empty()) {
            let full = self.root.join(path);
            if full.try_exists().context("test listed path")? && full.is_file() {
                paths.push(PathBuf::from(path));
            }
        }
        paths.sort();
        paths.dedup();
        Ok(paths)
    }

    fn output(&self, command: &CommandSpec) -> Result<String> {
        self.commands
            .output(&command.clone().in_directory(&self.root))
    }

    fn report(&self, message: &str) {
        println!("{message}");
    }
}

/// Decode a policy input at its IO boundary.
pub(super) fn text(environment: &dyn Environment, path: &str) -> Result<String> {
    String::from_utf8(environment.read(Path::new(path))?).with_context(|| format!("decode {path}"))
}
