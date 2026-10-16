//! Pool settings are pinned for the lifetime of one Serve process.

use std::path::PathBuf;

use mokly_catalogue::config_types::ResolvedConfig;

use crate::build::BuildError;

/// Settings which cannot change while a process pool remains active.
pub struct ServeSettings {
    repository: PathBuf,
}

impl ServeSettings {
    /// Capture the settings used to construct the pool.
    pub fn new(config: &ResolvedConfig) -> Self {
        Self {
            repository: config.repo_root.clone(),
        }
    }
    /// Reject a candidate before evaluating modules under a different pool configuration.
    pub fn validate(&self, config: &ResolvedConfig) -> Result<(), BuildError> {
        let setting = if self.repository != config.repo_root {
            Some("repoRoot")
        } else {
            None
        };
        match setting {
            Some(setting) => Err(BuildError::RestartRequired { setting }),
            None => Ok(()),
        }
    }
}

#[cfg(test)]
#[path = "_tests_/serve_settings_tests.rs"]
mod serve_settings_tests;
