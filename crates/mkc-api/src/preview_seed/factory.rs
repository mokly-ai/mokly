//! Seed composition shares the server's configured services without starting them.

use std::sync::Arc;
use std::time::Instant;

use mkc_auth::runtime::Runtime;
use mkc_auth::service::Authenticator;
use mkc_config::settings::Settings;
use mkc_file_store_interface::seed::SeedStore;

use crate::application::{ConfiguredApplicationFactory, SystemApplicationFactory};
use crate::health::BUILD_REVISION;
use crate::platform::service::Platform;
use crate::publishing::Publishing;

use super::catalogue::StoredSeedCatalogue;
use super::error::{Error, ErrorResultExt, Result};
use super::retry::RetryingSeedStore;
use super::service::{PreviewSeeder, SeedService};
use super::timing::{SystemClock, SystemSleeper};
use super::upload::IngestCatalogueUpload;

/// Build the one-time command with the same dependencies as the serving API.
pub trait PreviewSeedFactory {
    /// Require preview configuration before storage setup or database migration.
    fn create_seed(&self, settings: Settings) -> Result<Arc<dyn PreviewSeeder>>;
}

impl PreviewSeedFactory for SystemApplicationFactory {
    fn create_seed(&self, settings: Settings) -> Result<Arc<dyn PreviewSeeder>> {
        ConfiguredApplicationFactory::default().create_seed(settings)
    }
}

impl PreviewSeedFactory for ConfiguredApplicationFactory {
    fn create_seed(&self, settings: Settings) -> Result<Arc<dyn PreviewSeeder>> {
        if settings.preview_sign_in.is_none() {
            return Err(Error::Configuration);
        }
        Ok(self
            .compose(settings)
            .context("compose preview seed services")?
            .preview_seed)
    }
}

pub(crate) trait SeedComposer {
    fn compose(
        &self,
        auth: Arc<dyn Authenticator>,
        platform: Arc<dyn Platform>,
        publishing: &Publishing,
        runtime: Arc<dyn Runtime>,
    ) -> Arc<dyn PreviewSeeder>;
}

pub(crate) struct SystemSeedComposer;

impl SeedComposer for SystemSeedComposer {
    fn compose(
        &self,
        auth: Arc<dyn Authenticator>,
        platform: Arc<dyn Platform>,
        publishing: &Publishing,
        runtime: Arc<dyn Runtime>,
    ) -> Arc<dyn PreviewSeeder> {
        let files: Arc<dyn SeedStore> = Arc::new(RetryingSeedStore {
            inner: publishing.seed.clone(),
            clock: Arc::new(SystemClock {
                started: Instant::now(),
            }),
            sleeper: Arc::new(SystemSleeper),
        });
        Arc::new(SeedService {
            auth,
            platform,
            files: files.clone(),
            runtime,
            uploader: Arc::new(IngestCatalogueUpload {
                files: files.clone(),
                ingest: publishing.ingest.clone(),
            }),
            catalogue: Arc::new(StoredSeedCatalogue {
                files: files.clone(),
                reader: publishing.reader.clone(),
            }),
            locations: publishing.locations.clone(),
            revision: BUILD_REVISION,
        })
    }
}
