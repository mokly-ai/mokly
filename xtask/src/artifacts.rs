//! Native package assembly and shared TypeScript source generation.

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_model::typescript;
use mokly_sidecar::typescript::generate;

use crate::command::{CommandRunner, CommandSpec};
use crate::error::{Error, FilesystemResult, Result};

/// Artifact operations composed by the CLI.
#[cfg_attr(test, unimock::unimock(api = [BuildNativeMock, GenerateTypesMock, CheckGeneratedTypesMock]))]
pub(crate) trait Artifacts: Send + Sync {
    /// Build the host binary and copy it into the host npm package.
    fn build_native(&self) -> Result<()>;
    /// Write the model declarations imported by the viewer.
    fn generate_types(&self) -> Result<()>;
    /// Compare generated sources with disk without writing any file.
    fn check_generated_types(&self) -> Result<()>;
}

/// Filesystem boundary for artifact assembly.
#[cfg_attr(test, unimock::unimock(api = [CopyMock, WriteMock, ReadMock, EntriesMock]))]
pub(crate) trait ArtifactFiles: Send + Sync {
    /// Copy a built executable, creating the destination directory.
    fn copy(&self, source: &Path, destination: &Path) -> Result<()>;
    /// Write generated source, creating its parent directory.
    fn write(&self, destination: &Path, text: &str) -> Result<()>;
    /// Read exact source bytes, or return absence for a missing file.
    fn read(&self, path: &Path) -> Result<Option<Vec<u8>>>;
    /// List the paths in a generated directory, or an empty missing directory.
    fn entries(&self, directory: &Path) -> Result<Vec<PathBuf>>;
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

    fn read(&self, path: &Path) -> Result<Option<Vec<u8>>> {
        match fs::read(path) {
            Ok(bytes) => Ok(Some(bytes)),
            Err(source) if source.kind() == ErrorKind::NotFound => Ok(None),
            result => result
                .with_filesystem_context("read generated types", &path.display().to_string())
                .map(Some),
        }
    }

    fn entries(&self, directory: &Path) -> Result<Vec<PathBuf>> {
        let entries = match fs::read_dir(directory) {
            Ok(entries) => entries,
            Err(source) if source.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
            result => result.with_filesystem_context(
                "list generated types",
                &directory.display().to_string(),
            )?,
        };
        let mut paths = Vec::new();
        for entry in entries {
            paths.push(
                entry
                    .with_filesystem_context(
                        "read generated entry",
                        &directory.display().to_string(),
                    )?
                    .path(),
            );
        }
        paths.sort();
        Ok(paths)
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
    /// Operating system from the composition root.
    pub(crate) os: String,
    /// Architecture from the composition root.
    pub(crate) architecture: String,
    /// Cargo process boundary.
    pub(crate) commands: Arc<dyn CommandRunner>,
    /// Copy and source-write boundary.
    pub(crate) files: Arc<dyn ArtifactFiles>,
}

impl Artifacts for DefaultArtifacts {
    fn build_native(&self) -> Result<()> {
        let host = Host::resolve(&self.os, &self.architecture)?;
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
                    host.triple,
                    "--target-dir",
                    &target.display().to_string(),
                ])
                .in_directory(&self.workspace),
        )?;
        self.files.copy(
            &target.join(host.triple).join("debug").join(host.executable),
            &self.workspace.join(format!(
                "packages/native-{}/bin/{}",
                host.package, host.executable
            )),
        )
    }

    fn generate_types(&self) -> Result<()> {
        for (path, text) in generated_sources(&self.workspace) {
            self.files.write(&path, &text)?;
        }
        Ok(())
    }

    fn check_generated_types(&self) -> Result<()> {
        let sources = generated_sources(&self.workspace);
        for (path, text) in &sources {
            if self.files.read(path)?.as_deref() != Some(text.as_bytes()) {
                return Err(Error::GeneratedTypeMismatch { path: path.clone() });
            }
        }
        for directory in [
            "packages/viewer/src/generated",
            "packages/viewer/src/generated/catalogue",
            "packages/mokly/src/generated/sidecar",
        ] {
            for path in self.files.entries(&self.workspace.join(directory))? {
                if !sources
                    .iter()
                    .any(|(expected, _)| expected.starts_with(&path))
                {
                    return Err(Error::UnexpectedGeneratedType { path });
                }
            }
        }
        Ok(())
    }
}

/// One stable inventory shared by generation and byte comparison.
fn generated_sources(workspace: &Path) -> Vec<(PathBuf, String)> {
    let mut sources = vec![(
        workspace.join("packages/viewer/src/generated/model.ts"),
        typescript::generate(),
    )];
    sources.extend(
        typescript::catalogue_modules()
            .into_iter()
            .map(|(name, text)| {
                (
                    workspace
                        .join("packages/viewer/src/generated/catalogue")
                        .join(name),
                    text,
                )
            }),
    );
    sources.extend(generate().into_iter().map(|(name, text)| {
        (
            workspace
                .join("packages/mokly/src/generated/sidecar")
                .join(name),
            text,
        )
    }));
    sources
}

#[cfg(test)]
#[path = "_tests_/artifacts_tests.rs"]
mod artifacts_tests;

#[cfg(test)]
#[path = "_tests_/generated_types_tests.rs"]
mod generated_types_tests;
