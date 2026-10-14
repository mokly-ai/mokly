//! Native package assembly and shared TypeScript source generation.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_model::typescript;

use crate::command::{CommandRunner, CommandSpec};
use crate::error::{Error, FilesystemResult, Result};

/// Artifact operations composed by the CLI.
#[cfg_attr(test, unimock::unimock(api = [BuildNativeMock, GenerateTypesMock]))]
pub(crate) trait Artifacts: Send + Sync {
    /// Build the host binary and copy it into the host npm package.
    fn build_native(&self) -> Result<()>;
    /// Write the model declarations imported by the viewer.
    fn generate_types(&self) -> Result<()>;
}

/// Filesystem boundary for artifact assembly.
#[cfg_attr(test, unimock::unimock(api = [CopyMock, WriteMock]))]
pub(crate) trait ArtifactFiles: Send + Sync {
    /// Copy a built executable, creating the destination directory.
    fn copy(&self, source: &Path, destination: &Path) -> Result<()>;
    /// Write generated source, creating its parent directory.
    fn write(&self, destination: &Path, text: &str) -> Result<()>;
}

/// Host filesystem adapter.
pub(crate) struct SystemArtifactFiles;

impl ArtifactFiles for SystemArtifactFiles {
    fn copy(&self, source: &Path, destination: &Path) -> Result<()> {
        make_parent(destination)?;
        fs::copy(source, destination)
            .with_filesystem_context("copy native binary", &destination.display().to_string())?;
        Ok(())
    }

    fn write(&self, destination: &Path, text: &str) -> Result<()> {
        make_parent(destination)?;
        fs::write(destination, text)
            .with_filesystem_context("write generated types", &destination.display().to_string())
    }
}

fn make_parent(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_filesystem_context("create artifact directory", &parent.display().to_string())?;
    }
    Ok(())
}

/// Supported Rust target and its npm package suffix.
#[derive(Clone, Debug, PartialEq)]
pub(crate) struct Host {
    /// Rust compilation target.
    pub(crate) triple: &'static str,
    /// npm platform package suffix.
    pub(crate) package: &'static str,
    /// Executable basename.
    pub(crate) executable: &'static str,
}

impl Host {
    /// Resolve only the five supported platform/architecture pairs.
    pub(crate) fn resolve(os: &str, architecture: &str) -> Result<Self> {
        let (triple, package) = match (os, architecture) {
            ("linux", "x86_64") => ("x86_64-unknown-linux-gnu", "linux-x64-gnu"),
            ("linux", "aarch64") => ("aarch64-unknown-linux-gnu", "linux-arm64-gnu"),
            ("macos", "x86_64") => ("x86_64-apple-darwin", "darwin-x64"),
            ("macos", "aarch64") => ("aarch64-apple-darwin", "darwin-arm64"),
            ("windows", "x86_64") => ("x86_64-pc-windows-msvc", "win32-x64-msvc"),
            _ => {
                return Err(Error::NativeHost {
                    os: os.to_owned(),
                    architecture: architecture.to_owned(),
                });
            }
        };
        Ok(Self {
            triple,
            package,
            executable: if os == "windows" {
                "mokly.exe"
            } else {
                "mokly"
            },
        })
    }
}

/// Artifact coordinator with injected disk and subprocess boundaries.
pub(crate) struct DefaultArtifacts {
    /// Workspace root.
    pub(crate) workspace: PathBuf,
    /// Explicit host mapping from the composition root.
    pub(crate) host: Host,
    /// Cargo process boundary.
    pub(crate) commands: Arc<dyn CommandRunner>,
    /// Copy and source-write boundary.
    pub(crate) files: Arc<dyn ArtifactFiles>,
}

impl Artifacts for DefaultArtifacts {
    fn build_native(&self) -> Result<()> {
        let target = self.workspace.join("target/native");
        self.commands.run(
            &CommandSpec::new("cargo")
                .args([
                    "build",
                    "--package",
                    "mokly-cli",
                    "--bin",
                    "mokly",
                    "--target",
                    self.host.triple,
                    "--target-dir",
                    &target.display().to_string(),
                ])
                .in_directory(&self.workspace),
        )?;
        self.files.copy(
            &target
                .join(self.host.triple)
                .join("debug")
                .join(self.host.executable),
            &self.workspace.join(format!(
                "packages/native-{}/bin/{}",
                self.host.package, self.host.executable
            )),
        )
    }

    fn generate_types(&self) -> Result<()> {
        self.files.write(
            &self
                .workspace
                .join("packages/viewer/src/generated/model.ts"),
            &typescript::generate(),
        )
    }
}

#[cfg(test)]
#[path = "_tests_/artifacts_tests.rs"]
mod artifacts_tests;
