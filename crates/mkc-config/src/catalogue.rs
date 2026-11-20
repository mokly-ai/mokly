//! Standalone catalogue configuration without API mail credentials.

use crate::capabilities::DeploymentEnvironment;
use crate::desktop::DesktopConfig;
use crate::publications::{PublicationConfig, PublicationSettings};
use crate::settings::{EnvironmentConfig, Error, Result, validate_origin};

/// Catalogue binary settings, deliberately without Debug for the signing key.
pub struct CatalogueSettings {
    /// Shared migrated Postgres database.
    pub database_url: String,
    /// Public application origin for embedding and grant exchange.
    pub app_origin: String,
    /// Admit the privileged desktop origin alongside the public application.
    pub desktop_client: bool,
    /// Catalogue listener, storage and capabilities.
    pub publications: PublicationSettings,
}

/// Standalone configuration boundary.
pub trait CatalogueConfig {
    /// Load catalogue dependencies without requiring an email provider.
    fn catalogue(&self) -> Result<CatalogueSettings>;
}

impl CatalogueConfig for EnvironmentConfig {
    fn catalogue(&self) -> Result<CatalogueSettings> {
        let capabilities =
            DeploymentEnvironment::parse(self.environment.get("MKC_ENV").as_deref())?
                .capabilities();
        let database_url = self
            .environment
            .get("MKC_DATABASE_URL")
            .ok_or(Error::Invalid("MKC_DATABASE_URL"))?;
        if !database_url.starts_with("postgres://") && !database_url.starts_with("postgresql://") {
            return Err(Error::Invalid("MKC_DATABASE_URL"));
        }
        let app_origin = self
            .environment
            .get("MKC_APP_ORIGIN")
            .ok_or(Error::Invalid("MKC_APP_ORIGIN"))?;
        let app_origin =
            validate_origin(&app_origin, capabilities.http_loopback, "MKC_APP_ORIGIN")?;
        let publications = self.publications(capabilities.http_loopback, &app_origin)?;
        Ok(CatalogueSettings {
            database_url,
            app_origin,
            desktop_client: self.desktop_client()?,
            publications,
        })
    }
}
