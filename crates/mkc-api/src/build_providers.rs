//! The only E2B composition root; domain workers use provider-neutral traits.

use std::collections::HashMap;
use std::sync::Arc;

use mkc_build_interface::runner::BuildRunner;
use mkc_build_sandbox::clock::SystemBuildClock;
use mkc_build_sandbox::policy::denied_destinations;
use mkc_build_sandbox::runner::{BuildSandboxCapabilities, SandboxBuildRunner};
use mkc_config::builds::BuildSettings;
use sandbox_e2b::{E2bAdapterConfig, E2bProfile, E2bSandboxBackend};
use sandbox_interface::EgressDestination;

use crate::error::{ApiError, ApiErrorResultExt, Result};

/// Build provider behavior selected at the application composition root.
pub struct BuildProviders {
    /// Runner also owns cleanup when its future is dropped.
    pub runner: Arc<dyn BuildRunner>,
    /// Deployment inventory reconciliation shares the same backend.
    pub sandbox: BuildSandboxCapabilities,
}

/// Injectable provider factory for configured applications and server smoke tests.
pub trait BuildProviderFactory: Send + Sync {
    /// Validate provider configuration without creating a sandbox.
    fn create(&self, config: &BuildSettings) -> Result<BuildProviders>;
}

/// Production backend with the fixed E2B HTTPS API and one build profile.
pub struct SystemBuildProviderFactory;

impl BuildProviderFactory for SystemBuildProviderFactory {
    fn create(&self, config: &BuildSettings) -> Result<BuildProviders> {
        let mut additional = Vec::new();
        for value in &config.denied_destinations {
            let destination = if let Some((address, prefix)) = value.split_once('/') {
                let Ok(address) = address.parse() else {
                    return Err(ApiError::ValidationFailed);
                };
                let Ok(prefix) = prefix.parse() else {
                    return Err(ApiError::ValidationFailed);
                };
                EgressDestination::cidr(address, prefix).context("validate build egress network")?
            } else {
                let Ok(address) = value.parse() else {
                    return Err(ApiError::ValidationFailed);
                };
                EgressDestination::Ip(address)
            };
            additional.push(destination);
        }
        let profiles = HashMap::from([(
            "build".to_owned(),
            E2bProfile {
                template: config.template.clone(),
                allow_public_egress: true,
                denied_destinations: denied_destinations(&additional)
                    .context("build sandbox egress policy")?,
            },
        )]);
        let adapter = E2bAdapterConfig::new(
            "e2b",
            "https://api.e2b.dev",
            config.api_key.clone(),
            profiles,
            60,
        )
        .context("configure build sandbox backend")?;
        let backend =
            Arc::new(E2bSandboxBackend::new(adapter).context("construct build sandbox backend")?);
        let sandbox = BuildSandboxCapabilities {
            lifecycle: backend.clone(),
            files: backend.clone(),
            processes: backend,
        };
        let runner: Arc<dyn BuildRunner> = Arc::new(
            SandboxBuildRunner::new(
                sandbox.clone(),
                Arc::new(SystemBuildClock),
                config.deployment_id.clone(),
            )
            .context("construct sandbox build runner")?,
        );
        Ok(BuildProviders { runner, sandbox })
    }
}
