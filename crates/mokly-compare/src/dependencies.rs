//! Three base dependency tiers and typed bundle-resolution results.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use mokly_git::identity::RepoPath;
use mokly_sidecar::methods::ModuleResolution;

use crate::cache_types::{Builder, Cache, Kind, Lease, Storage};
use crate::commands::{Command, Commands};
use crate::error::{Error, InternalError, Result};
use crate::inputs::Inputs;

/// Selected dependency tier from the comparison contract.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Tier {
    /// Equal manifests and lockfiles reuse the working installation.
    Working,
    /// Different inputs use a cached base installation.
    Installed,
    /// An impossible installation reuses the working installation with a warning.
    Fallback,
}

/// Why the base dependency installation could not be used.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Fallback {
    /// Unsupported manager, missing lockfile or unavailable command.
    Unavailable,
    /// Manager could not complete, including offline failures.
    Failed,
    /// Install reached its deadline.
    Timeout,
    /// Install or active entries exceeded the cache budget.
    Size,
}

/// Configuration-attributed warning for conversion to a build diagnostic.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Warning {
    /// Repository-relative configuration subject.
    pub configuration: RepoPath,
    /// Differing lockfile, or selected lockfile for a manifest-only change.
    pub lockfile: Option<RepoPath>,
    /// Typed fallback cause.
    pub reason: Fallback,
}

impl Warning {
    /// Stable build diagnostic code.
    pub fn code(&self) -> &'static str {
        "base-dependencies"
    }

    /// One-line warning text. The terminal adds the configuration subject.
    pub fn message(&self) -> String {
        let name = self
            .lockfile
            .as_ref()
            .map(RepoPath::as_str)
            .unwrap_or("no lockfile");
        format!(
            "base dependencies differ at {}; using working-tree dependencies",
            quoted(name)
        )
    }
}

/// Base inputs and source roots prepared before a bundle request.
pub struct Request {
    /// Exact base lockfile and package manifests.
    pub base: Inputs,
    /// Exact working-tree lockfile and package manifests.
    pub head: Inputs,
    /// Leased base extraction directory. The caller retains its source lease.
    pub source_root: PathBuf,
    /// Immutable source identity, used for local file dependencies.
    pub source_identity: String,
    /// Current repository root.
    pub head_root: PathBuf,
    /// Configuration subject for a fallback warning.
    pub configuration: RepoPath,
    /// Normalized source-relative package roots and other bundle settings.
    pub resolution: ModuleResolution,
}

/// Dependency locations and settings for the sidecar's bundle method.
pub struct Resolved {
    /// Dependency tier.
    pub tier: Tier,
    /// Primary dependency directory.
    pub node_modules: PathBuf,
    /// Bundle module-resolution settings with chosen installation roots.
    pub module_resolution: ModuleResolution,
    /// Fallback warning, present only for tier three.
    pub warning: Option<Warning>,
    /// Installed cache lease, retained while the bundle uses its files.
    pub lease: Option<Lease>,
}

/// Base dependency preparation boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DependenciesMock))]
pub trait Dependencies: Send + Sync {
    /// Compare identities, acquire a base install when needed, or warn and fall back.
    fn resolve(&self, request: &Request) -> Result<Resolved>;
}

/// Npm dependency tiers. Unsupported managers use the documented fallback.
pub struct DependencyTiers {
    /// Content-addressed dependency cache.
    pub cache: Arc<dyn Cache>,
    /// Bounded shell-free package-manager execution.
    pub commands: Arc<dyn Commands>,
    /// Source copying and install-size measurement.
    pub storage: Arc<dyn Storage>,
    /// Package-manager deadline, also used for version discovery.
    pub timeout: Duration,
    /// Maximum staged install bytes.
    pub install_bytes: u64,
}

struct Install<'a> {
    request: &'a Request,
    owner: &'a DependencyTiers,
}

impl Builder for Install<'_> {
    fn build(&self, destination: &Path) -> Result<()> {
        self.owner.storage.copy(
            &self.request.source_root,
            destination,
            self.owner.install_bytes,
        )?;
        let mut args: Vec<OsString> = [
            "ci",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--cache",
            ".npm-cache",
            "--logs-dir",
            ".npm-cache/_logs",
        ]
        .into_iter()
        .map(Into::into)
        .collect();
        args.extend([
            OsString::from("--prefix"),
            destination.as_os_str().to_owned(),
        ]);
        self.owner.commands.run(&Command {
            program: "npm".into(),
            args,
            directory: destination.to_owned(),
            timeout: self.owner.timeout,
            byte_limit: Some(self.owner.install_bytes),
        })?;
        Ok(())
    }
}

impl Dependencies for DependencyTiers {
    fn resolve(&self, request: &Request) -> Result<Resolved> {
        if request.base == request.head {
            return Ok(resolved(
                request,
                Tier::Working,
                &request.head_root,
                None,
                None,
            ));
        }
        let attempt = (|| {
            if !request.base.supports_npm() {
                return Err(Error::UnsupportedManager);
            }
            request.base.validate_install()?;
            let version = self.commands.run(&Command {
                program: "npm".into(),
                args: vec!["--version".into()],
                directory: request.source_root.clone(),
                timeout: self.timeout,
                byte_limit: None,
            })?;
            let version = match str::from_utf8(&version) {
                Ok(version) if !version.trim().is_empty() => version.trim(),
                _ => return Err(Error::UnsupportedManager),
            };
            let key = request.base.key(version, &request.source_identity);
            self.cache.get(
                Kind::Dependencies,
                &key,
                &Install {
                    request,
                    owner: self,
                },
            )
        })();
        match attempt {
            Ok(lease) => {
                let directory = lease.directory.clone();
                Ok(resolved(
                    request,
                    Tier::Installed,
                    &directory,
                    Some(lease),
                    None,
                ))
            }
            Err(Error::Cancelled) => Err(Error::Cancelled),
            Err(error) => {
                let reason = match error {
                    Error::InstallTimeout => Fallback::Timeout,
                    Error::CacheLimit { .. } => Fallback::Size,
                    Error::UnsupportedManager => Fallback::Unavailable,
                    Error::Internal(InternalError::Io { source })
                        if source.kind() == std::io::ErrorKind::NotFound =>
                    {
                        Fallback::Unavailable
                    }
                    _ => Fallback::Failed,
                };
                tracing::warn!(?reason, "base dependency installation fell back");
                let warning = Warning {
                    configuration: request.configuration.clone(),
                    lockfile: request.base.differing_lockfile(&request.head),
                    reason,
                };
                Ok(resolved(
                    request,
                    Tier::Fallback,
                    &request.head_root,
                    None,
                    Some(warning),
                ))
            }
        }
    }
}

fn resolved(
    request: &Request,
    tier: Tier,
    root: &Path,
    lease: Option<Lease>,
    warning: Option<Warning>,
) -> Resolved {
    let mut resolution = request.resolution.clone();
    resolution.package_roots = std::iter::once(root.to_string_lossy().into_owned())
        .chain(
            request
                .resolution
                .package_roots
                .iter()
                .map(|path| root.join(path).to_string_lossy().into_owned()),
        )
        .collect();
    Resolved {
        tier,
        node_modules: root.join("node_modules"),
        module_resolution: resolution,
        warning,
        lease,
    }
}

#[cfg(test)]
#[path = "_tests_/dependencies_tests.rs"]
mod dependencies_tests;

fn quoted(value: &str) -> String {
    let mut output = String::from("\"");
    for character in value.chars() {
        match character {
            character if character.is_control() => {
                output.push_str(&format!("\\u{:04x}", u32::from(character)))
            }
            '\\' => output.push_str("\\\\"),
            '"' => output.push_str("\\\""),
            character => output.push(character),
        }
    }
    output.push('"');
    output
}
