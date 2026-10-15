//! Base repository packages with three third-party dependency tiers.

use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use mokly_git::control::Clock;

use crate::cache_types::{Cache, Kind, Lease, Storage};
use crate::commands::{Command, Commands};
use crate::dependency_types::{Fallback, Request, Resolved, Tier, Warning};
use crate::error::{Error, Result};
use crate::install::{self, Install};
use crate::overlay::Overlays;

/// Base dependency selection boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DependenciesMock))]
pub trait Dependencies: Send + Sync {
    /// Resolve repository packages from base sources, then select third-party dependencies.
    fn resolve(&self, request: &Request) -> Result<Resolved>;
}

/// Third-party installation and repository-package overlay coordinator.
pub struct DependencyTiers {
    /// Bounded dependency namespace.
    pub cache: Arc<dyn Cache>,
    /// Fixed package-manager commands.
    pub commands: Arc<dyn Commands>,
    /// Source copying and size measurement.
    pub storage: Arc<dyn Storage>,
    /// Base-owned package overlays, used by every tier.
    pub overlays: Arc<dyn Overlays>,
    /// Monotonic clock for the single install deadline.
    pub clock: Arc<dyn Clock>,
    /// Version discovery and all installs share this allowance.
    pub timeout: Duration,
    /// Per-install disk bound.
    pub install_bytes: u64,
}

impl Dependencies for DependencyTiers {
    fn resolve(&self, request: &Request) -> Result<Resolved> {
        let overlay = self.overlays.acquire(
            &request.base,
            &request.source_root,
            &request.source_identity,
        )?;
        let validation = request.base.validate_install();
        if request.base == request.head && validation.is_ok() {
            return Ok(resolved(
                request,
                Tier::Working,
                &request.head_root,
                None,
                overlay,
                None,
            ));
        }
        let attempt = (|| {
            let deadline = self.clock.now().saturating_add(self.timeout);
            validation?;
            let roots = install::roots(&request.base, &request.resolution.package_roots)?;
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
                let directory = lease.directory.clone();
                Ok(resolved(
                    request,
                    Tier::Installed,
                    &directory,
                    Some(lease),
                    overlay,
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
                    overlay,
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
    overlay: Option<Lease>,
    warning: Option<Warning>,
) -> Resolved {
    let mut resolution = request.resolution.clone();
    resolution.package_roots = overlay
        .iter()
        .map(|lease| lease.directory.to_string_lossy().into_owned())
        .chain(std::iter::once(root.to_string_lossy().into_owned()))
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
        overlay,
    }
}

#[cfg(test)]
#[path = "_tests_/dependencies_tests.rs"]
mod dependencies_tests;
