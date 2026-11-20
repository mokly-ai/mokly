//! API composition-root assembly of publication interfaces and adapters.

use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_config::publications::PublicationSettings;
use mkc_file_store_interface::seed::SeedStore;
use mkc_file_store_interface::store::FileStore;
use mkc_mokly_contract::archive::{GzipTarReader, TarballReader};
use mkc_mokly_contract::bundle::{ContractValidator, UploadValidator};
use mkc_mokly_contract::limits::Limits;
use mkc_publications::access::{CatalogueAccess, CatalogueAccessService};
use mkc_publications::blob_writer::{BlobWriter, ParallelBlobWriter};
use mkc_publications::capability::{CapabilityFactory, HmacCapabilityFactory};
use mkc_publications::ingest::{Ingest, PublicationIngest};
use mkc_publications::locations::Locations;
use mkc_publications::policy::{AccessPolicy, DatabaseAccessPolicy};
use mkc_publications::transaction::{StoreTransactions, Transactions};
use mkc_store_interface::store::Store;
use mkc_upload_memory::budget::ProcessUploadMemoryBudget;
use mkc_upload_memory_interface::budget::UploadMemoryBudget;
use tokio::sync::Semaphore;

use crate::error::{ApiErrorResultExt, Result};
use crate::publishing_storage::{StorageFactory, SystemStorageFactory};
use crate::upload::{StreamingUpload, UploadHandler};
use crate::viewer::artifacts::StoredArtifacts;
use crate::viewer::service::{Viewer, ViewerService};

pub(crate) struct Publishing {
    pub(crate) seed: Arc<dyn SeedStore>,
    pub(crate) ingest: Arc<dyn Ingest>,
    pub(crate) reader: Arc<dyn TarballReader>,
    pub(crate) files: Arc<dyn FileStore>,
    pub(crate) transactions: Arc<dyn Transactions>,
    pub(crate) locations: Locations,
    pub(crate) viewer: Arc<dyn Viewer>,
    pub(crate) upload: Arc<dyn UploadHandler>,
    pub(crate) access: Arc<dyn CatalogueAccess>,
}

pub(crate) trait PublishingFactory {
    fn create(
        &self,
        settings: &PublicationSettings,
        app_origin: &str,
        api_origin: &str,
        store: Arc<dyn Store>,
        runtime: Arc<dyn Runtime>,
    ) -> Result<Publishing>;
}

pub(crate) struct SystemPublishingFactory;

impl PublishingFactory for SystemPublishingFactory {
    fn create(
        &self,
        settings: &PublicationSettings,
        app_origin: &str,
        api_origin: &str,
        store: Arc<dyn Store>,
        runtime: Arc<dyn Runtime>,
    ) -> Result<Publishing> {
        let storage = SystemStorageFactory.create(&settings.storage)?;
        let files = storage.files;
        let transactions: Arc<dyn Transactions> = Arc::new(StoreTransactions {
            store: store.clone(),
        });
        let upload_memory: Arc<dyn UploadMemoryBudget> =
            Arc::new(ProcessUploadMemoryBudget::new(settings.upload_memory_bytes));
        let writer: Arc<dyn BlobWriter> = Arc::new(ParallelBlobWriter {
            files: files.clone(),
            transactions: transactions.clone(),
            runtime: runtime.clone(),
            worker_count: settings.ingest_workers,
        });
        let policy: Arc<dyn AccessPolicy> = Arc::new(DatabaseAccessPolicy);
        let locations = Locations {
            app_origin: app_origin.to_owned(),
            catalogue_domain: settings.domain.clone(),
            catalogue_scheme: settings.scheme.clone(),
            catalogue_port: settings.port,
        };
        let viewer: Arc<dyn Viewer> = Arc::new(ViewerService {
            store,
            artifacts: Arc::new(StoredArtifacts {
                files: files.clone(),
            }),
            locations: locations.clone(),
        });
        let access: Arc<dyn CatalogueAccess> = Arc::new(CatalogueAccessService {
            transactions: transactions.clone(),
            policy: policy.clone(),
            runtime: runtime.clone(),
            capabilities: HmacCapabilityFactory
                .create(&settings.signing_key)
                .context("initialize catalogue access signer")?,
            locations: locations.clone(),
        });
        let reader: Arc<dyn TarballReader> = Arc::new(GzipTarReader::new(upload_memory.clone()));
        let validator: Arc<dyn UploadValidator> = Arc::new(ContractValidator {
            reader: reader.clone(),
            limits: Limits::default(),
        });
        let ingest: Arc<dyn Ingest> = Arc::new(PublicationIngest {
            transactions: transactions.clone(),
            runtime,
            policy,
            writer,
            validator,
            files: files.clone(),
        });
        let upload: Arc<dyn UploadHandler> = Arc::new(StreamingUpload {
            ingest: ingest.clone(),
            locations: locations.clone(),
            api_origin: api_origin.to_owned(),
            admission: Arc::new(Semaphore::new(2)),
            memory: upload_memory,
            blob_gzip: settings.upload_blob_gzip,
        });
        Ok(Publishing {
            seed: storage.seed,
            ingest,
            reader,
            files,
            transactions,
            locations,
            upload,
            access,
            viewer,
        })
    }
}
