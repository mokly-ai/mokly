//! Optional all-or-none build settings with no secret-bearing diagnostics.

use std::net::IpAddr;
use std::sync::Arc;

use ipnet::IpNet;

use crate::settings::{Environment, Error, Result};

/// Build settings used only at the API composition root; never serialized or logged.
pub struct BuildSettings {
    /// Worker-only E2B API credential.
    pub api_key: String,
    /// Released build template ID.
    pub template: String,
    /// Deployment inventory namespace, exclusive to builds.
    pub deployment_id: String,
    /// Validated IP addresses or CIDRs; the runner adds the fixed deny ranges.
    pub denied_destinations: Vec<String>,
    /// Concurrent attempts in each process, from one through sixteen.
    pub per_process: usize,
}

/// Build configuration boundary independent of serving dependencies.
pub trait BuildConfigProvider {
    /// Require a complete GitHub group whenever builds are enabled.
    fn load(&self, github_configured: bool) -> Result<Option<BuildSettings>>;
}

/// Validate build settings through the shared environment seam.
pub struct BuildEnvironmentConfig {
    /// Injected environment reads.
    pub environment: Arc<dyn Environment>,
}

impl BuildConfigProvider for BuildEnvironmentConfig {
    fn load(&self, github_configured: bool) -> Result<Option<BuildSettings>> {
        let keys = [
            "MKC_E2B_API_KEY",
            "MKC_E2B_BUILD_TEMPLATE",
            "MKC_E2B_DEPLOYMENT_ID",
        ];
        let values: Vec<_> = keys.iter().map(|key| self.environment.get(key)).collect();
        let ceiling = self.environment.get("MKC_BUILDS_PER_PROCESS");
        let denied = self.environment.get("MKC_E2B_DENIED_DESTINATIONS");
        if values.iter().all(Option::is_none) && ceiling.is_none() && denied.is_none() {
            return Ok(None);
        }
        let get = |index: usize| {
            values[index]
                .clone()
                .filter(|value| !value.is_empty() && value.trim() == value)
                .ok_or(Error::Invalid(keys[index]))
        };
        let api_key = get(0)?;
        let template = get(1)?;
        let deployment_id = get(2)?;
        if !github_configured {
            return Err(Error::Invalid("MKC_GITHUB_APP_ID"));
        }
        if !(1..=63).contains(&deployment_id.len())
            || !deployment_id
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        {
            return Err(Error::Invalid(keys[2]));
        }
        let per_process = match ceiling {
            None => 4,
            Some(value) => match value.parse::<usize>() {
                Ok(value @ 1..=16) => value,
                _ => return Err(Error::Invalid("MKC_BUILDS_PER_PROCESS")),
            },
        };
        let denied_destinations = match denied {
            None => Vec::new(),
            Some(value) => destinations(&value)?,
        };
        Ok(Some(BuildSettings {
            api_key,
            template,
            deployment_id,
            denied_destinations,
            per_process,
        }))
    }
}

fn destinations(value: &str) -> Result<Vec<String>> {
    let mut destinations = Vec::new();
    for part in value.split(',') {
        let part = part.trim();
        let parsed = if let Ok(address) = part.parse::<IpAddr>() {
            address.to_string()
        } else if let Ok(network) = part.parse::<IpNet>() {
            network.trunc().to_string()
        } else {
            return Err(Error::Invalid("MKC_E2B_DENIED_DESTINATIONS"));
        };
        destinations.push(parsed);
    }
    if destinations.len() > 32 {
        return Err(Error::Invalid("MKC_E2B_DENIED_DESTINATIONS"));
    }
    destinations.sort();
    destinations.dedup();
    Ok(destinations)
}

#[cfg(test)]
#[path = "_tests_/builds_tests.rs"]
mod tests;
