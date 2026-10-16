//! Three dependency tiers with repository roots for side-local module resolution.

use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use mokly_git::control::Clock;

use crate::ancestor_roots;
use crate::cache_types::{Cache, Kind, Lease, Storage};
use crate::commands::{Command, Commands};
use crate::dependency_types::{Fallback, Request, Resolved, Tier, Warning};
use crate::error::{Error, Result};
use crate::install::{self, Install};

/// Base dependency selection boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DependenciesMock))]
pub trait Dependencies: Send + Sync {
    /// Select dependencies and the repository roots that must map to side sources.
    fn resolve(&self, request: &Request) -> Result<Resolved>;
}

/// Third-party installation coordinator. The sidecar maps repository sources.
pub struct DependencyTiers {
    /// Bounded dependency namespace.
    pub cache: Arc<dyn Cache>,
    /// Fixed package-manager commands.
    pub commands: Arc<dyn Commands>,
    /// Source copying and size measurement.
    pub storage: Arc<dyn Storage>,
    /// Monotonic clock for the single install deadline.
    pub clock: Arc<dyn Clock>,
    /// Version discovery and all installs share this allowance.
    pub timeout: Duration,
    /// Per-install disk bound.
    pub install_bytes: u64,
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
            let deadline = self.clock.now().saturating_add(self.timeout);
            request.base.validate_install()?;
            let configured = package_roots(request);
            let roots = install::roots(&request.base, &configured)?;
            let version = self.commands.run(&Command {
                program: "npm".into(),
                args: vec!["--version".into()],
                directory: request.source_root.clone(),
                timeout: self.timeout,
                byte_limit: None,
                size_root: None,
            })?;
            let version = match str::from_utf8(&version) {
                Ok(version) if !version.trim().is_empty() => version.trim(),
                _ => return Err(Error::UnsupportedManager),
            };
            let key = install::key(&request.base, version, &request.source_identity, &roots);
            self.cache.get(
                Kind::Dependencies,
                &key,
                &Install {
                    request,
                    owner: self,
                    roots,
                    deadline,
                },
            )
        })();
        match attempt {
            Ok(lease) => {
                for directory in &request.used_directories {
                    if !self.storage.directory(&lease.directory.join(directory))? {
                        return Ok(fallback(
                            request,
                            Fallback::MissingDirectory(directory.clone()),
                        ));
                    }
                }
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
                    Error::UnsupportedManager | Error::CommandUnavailable => Fallback::Unavailable,
                    Error::InstallFailed { .. } | Error::CommandOutputLimit => Fallback::Failed,
                    Error::LocalOutside { .. } => Fallback::LocalOutside,
                    Error::InvalidInput { .. } => Fallback::InvalidInput,
                    _ => Fallback::Cache,
                };
                tracing::warn!(
                    ?reason,
                    "base third-party dependency installation fell back"
                );
                Ok(fallback(request, reason))
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
    resolution.package_roots = package_roots(request)
        .iter()
        .map(|path| {
            if path.is_empty() {
                root.to_owned()
            } else {
                root.join(path)
            }
            .to_string_lossy()
            .into_owned()
        })
        .collect();
    let mut repository_roots = vec![request.head_root.clone()];
    if tier == Tier::Installed && root != request.head_root {
        repository_roots.push(root.to_owned());
    }
    Resolved {
        tier,
        node_modules: root.join("node_modules"),
        module_resolution: resolution,
        warning,
        lease,
        repository_roots,
    }
}

fn package_roots(request: &Request) -> Vec<String> {
    let directory = Path::new(request.configuration.as_str())
        .parent()
        .unwrap_or(Path::new(""));
    let mut roots = ancestor_roots::directories(&directory.to_string_lossy());
    for root in &request.resolution.package_roots {
        if !roots.contains(root) {
            roots.push(root.clone());
        }
    }
    roots
}

fn fallback(request: &Request, reason: Fallback) -> Resolved {
    resolved(
        request,
        Tier::Fallback,
        &request.head_root,
        None,
        Some(Warning {
            configuration: request.configuration.clone(),
            lockfile: request
                .base
                .differing_lockfile(&request.head, &package_roots(request)),
            reason,
        }),
    )
}

#[cfg(test)]
#[path = "_tests_/dependencies_tests.rs"]
mod dependencies_tests;

#[cfg(test)]
#[path = "_tests_/ancestor_tests.rs"]
mod ancestor_tests;
