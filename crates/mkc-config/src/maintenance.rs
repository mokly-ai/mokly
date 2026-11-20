//! Maintenance settings independent of serving credentials and GitHub providers.

use std::path::PathBuf;

use crate::capabilities::DeploymentEnvironment;
use crate::publications::FileStorage;
use crate::settings::{EnvironmentConfig, Error, Result};

/// Validated retention intervals measured after the record's expiry.
pub struct MaintenanceSettings {
    /// Database with current migrations already applied.
    pub database_url: String,
    /// Seconds to retain expired magic-link digests.
    pub link_seconds: u32,
    /// Seconds to retain expired sessions.
    pub session_seconds: u32,
    /// Seconds to retain reset admission counters.
    pub rate_seconds: u32,
    /// Seconds to retain finished builds and their logs.
    pub build_seconds: u32,
}

/// Database-only retention settings for GitHub authentication and deliveries.
pub struct GitHubRetentionSettings {
    /// Database with current migrations already applied.
    pub database_url: String,
    /// Seconds to retain an expired OAuth flow hash.
    pub oauth_seconds: u32,
    /// Seconds to retain a terminal raw webhook delivery.
    pub delivery_seconds: u32,
}

/// Settings required by failed-upload recovery and unreferenced object cleanup.
pub struct PublicationMaintenanceSettings {
    /// Database with current migrations already applied.
    pub database_url: String,
    /// Explicit private object-store adapter.
    pub storage: FileStorage,
}

/// Environment access for operator maintenance commands.
pub trait MaintenanceConfig {
    /// Load database and bounded nonnegative retention intervals only.
    fn maintenance(&self) -> Result<MaintenanceSettings>;
}

/// Environment access for GitHub record cleanup.
pub trait GitHubRetentionConfig {
    /// Load database and bounded GitHub retention intervals only.
    fn github_retention(&self) -> Result<GitHubRetentionSettings>;
}

/// Environment access for publication maintenance composition.
pub trait PublicationMaintenanceConfig {
    /// Load only the database and explicit file-store settings.
    fn publication_maintenance(&self) -> Result<PublicationMaintenanceSettings>;
}

fn database_url(config: &EnvironmentConfig) -> Result<String> {
    config
        .environment
        .get("MKC_DATABASE_URL")
        .filter(|url| url.starts_with("postgres://") || url.starts_with("postgresql://"))
        .ok_or(Error::Invalid("MKC_DATABASE_URL"))
}

fn seconds(config: &EnvironmentConfig, key: &'static str, default: u32) -> Result<u32> {
    match config.environment.get(key) {
        None => Ok(default),
        Some(value) => match value.parse::<u32>() {
            Ok(seconds) if seconds <= 31_536_000 => Ok(seconds),
            _ => Err(Error::Invalid(key)),
        },
    }
}

impl MaintenanceConfig for EnvironmentConfig {
    fn maintenance(&self) -> Result<MaintenanceSettings> {
        Ok(MaintenanceSettings {
            database_url: database_url(self)?,
            link_seconds: seconds(self, "MKC_AUTH_LINK_RETENTION_SECONDS", 604_800)?,
            session_seconds: seconds(self, "MKC_AUTH_SESSION_RETENTION_SECONDS", 86_400)?,
            rate_seconds: seconds(self, "MKC_AUTH_RATE_RETENTION_SECONDS", 86_400)?,
            build_seconds: seconds(self, "MKC_BUILD_RETENTION_SECONDS", 2_592_000)?,
        })
    }
}

impl GitHubRetentionConfig for EnvironmentConfig {
    fn github_retention(&self) -> Result<GitHubRetentionSettings> {
        Ok(GitHubRetentionSettings {
            database_url: database_url(self)?,
            oauth_seconds: seconds(self, "MKC_GITHUB_OAUTH_RETENTION_SECONDS", 86_400)?,
            delivery_seconds: seconds(self, "MKC_GITHUB_DELIVERY_RETENTION_SECONDS", 2_592_000)?,
        })
    }
}

impl PublicationMaintenanceConfig for EnvironmentConfig {
    fn publication_maintenance(&self) -> Result<PublicationMaintenanceSettings> {
        let development = DeploymentEnvironment::parse(self.environment.get("MKC_ENV").as_deref())?
            .capabilities()
            .http_loopback;
        let storage = match self.environment.get("MKC_FILE_STORE").as_deref() {
            Some("gcs") => {
                let bucket = self
                    .environment
                    .get("MKC_GCS_BUCKET")
                    .filter(|value| !value.is_empty())
                    .ok_or(Error::Invalid("MKC_GCS_BUCKET"))?;
                let prefix = match self.environment.get("MKC_GCS_PREFIX") {
                    None => None,
                    Some(value) if value.is_empty() => None,
                    Some(value) => match value.parse() {
                        Ok(prefix) => Some(prefix),
                        Err(_) => return Err(Error::Invalid("MKC_GCS_PREFIX")),
                    },
                };
                FileStorage::Gcs { bucket, prefix }
            }
            Some("local") if development => FileStorage::Local(PathBuf::from(
                self.environment
                    .get("MKC_FILE_STORE_ROOT")
                    .filter(|value| !value.is_empty())
                    .ok_or(Error::Invalid("MKC_FILE_STORE_ROOT"))?,
            )),
            _ => return Err(Error::Invalid("MKC_FILE_STORE")),
        };
        Ok(PublicationMaintenanceSettings {
            database_url: database_url(self)?,
            storage,
        })
    }
}

#[cfg(test)]
#[path = "_tests_/maintenance_tests.rs"]
mod tests;
