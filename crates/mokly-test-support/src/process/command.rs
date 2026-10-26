//! Prepare invocations of the `mokly` binary or of a Node shim.

use std::ffi::OsStr;
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::workspace;

use super::running::{Finished, Running};

/// The standard-output prefix of the private build that `mokly publish` reports.
pub const PUBLISH_BUILD: &str = "Mokly publish build: ";

/// Builds invocations of the `mokly` command: the native binary or a Node shim.
#[derive(Clone, Debug)]
pub struct Mokly {
    program: PathBuf,
    shim: Option<PathBuf>,
}

impl Mokly {
    /// Use the binary at `binary`, normally `env!("CARGO_BIN_EXE_mokly")`.
    pub fn new(binary: impl Into<PathBuf>) -> Self {
        Self {
            program: binary.into(),
            shim: None,
        }
    }

    /// Run the installed `bin/mokly.mjs` shim at `shim` with Node.
    pub fn node_shim(shim: impl Into<PathBuf>) -> Self {
        Self {
            program: PathBuf::from("node"),
            shim: Some(shim.into()),
        }
    }

    /// Prepare `mokly {args}` in `root` with the output mode `mode`.
    ///
    /// The child inherits the test environment without its `MOKLY_` variables.
    /// It gets the output mode. The native binary also gets the package root
    /// and the viewer bundle of the checkout, which a shim finds itself.
    pub fn command(&self, root: &Path, args: &[&str], mode: &str) -> Invocation {
        let mut command = Command::new(&self.program);
        command.current_dir(root).args(&self.shim).args(args);
        for (name, _) in std::env::vars_os() {
            if name.to_string_lossy().starts_with("MOKLY_") {
                command.env_remove(name);
            }
        }
        command.env("MOKLY_OUTPUT", mode);
        if self.shim.is_none() {
            command
                .env("MOKLY_PACKAGE_ROOT", workspace::package_root())
                .env("MOKLY_VIEWER_DIST", workspace::viewer_dist());
        }
        command
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        Invocation { command }
    }
}

/// One prepared invocation that a test can adjust before it starts.
pub struct Invocation {
    command: Command,
}

impl Invocation {
    /// Set the environment variable `name` for the child.
    pub fn env(mut self, name: &str, value: impl AsRef<OsStr>) -> Self {
        self.command.env(name, value);
        self
    }

    /// Remove the environment variable `name` for the child.
    pub fn env_remove(mut self, name: &str) -> Self {
        self.command.env_remove(name);
        self
    }

    /// Start the child as the leader of a new process group.
    #[cfg(unix)]
    pub fn process_group(mut self) -> Self {
        self.command.process_group(0);
        self
    }

    /// Start the child and the threads that capture its output.
    pub fn spawn(self) -> Running {
        Running::start(self.command)
    }

    /// Run the child to completion.
    pub fn run(self) -> Finished {
        self.spawn().wait()
    }
}
