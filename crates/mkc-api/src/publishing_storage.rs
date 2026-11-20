//! Shared content and seed adapters under the same configured storage root.

use std::sync::Arc;

use mkc_config::publications::FileStorage;
use mkc_file_store_gcs::credentials::{CredentialsFactory, MetadataCredentialsFactory};
use mkc_file_store_gcs::store::GcsFileStore;
use mkc_file_store_gcs::transport::{HttpFactory, ReqwestHttpFactory};
use mkc_file_store_interface::seed::SeedStore;
use mkc_file_store_interface::store::FileStore;
use mkc_file_store_local::directory::{FileStoreFactory, LocalFileStoreFactory, SeedStoreFactory};

use crate::error::{ApiErrorResultExt, Result};

pub(crate) struct Storage {
    pub(crate) files: Arc<dyn FileStore>,
    pub(crate) seed: Arc<dyn SeedStore>,
}

pub(crate) trait StorageFactory {
    fn create(&self, settings: &FileStorage) -> Result<Storage>;
}

pub(crate) struct SystemStorageFactory;

impl StorageFactory for SystemStorageFactory {
    fn create(&self, settings: &FileStorage) -> Result<Storage> {
        match settings {
            FileStorage::Local(root) => Ok(Storage {
                files: LocalFileStoreFactory
                    .open(root)
                    .context("initialize local publication storage")?,
                seed: LocalFileStoreFactory
                    .open_seed(root)
                    .context("initialize local seed storage")?,
            }),
            FileStorage::Gcs { bucket, prefix } => {
                let files = Arc::new(GcsFileStore::new(
                    "https://storage.googleapis.com".to_owned(),
                    bucket.clone(),
                    prefix.clone(),
                    ReqwestHttpFactory
                        .build(
                            MetadataCredentialsFactory
                                .metadata()
                                .context("initialize workload credentials")?,
                        )
                        .context("initialize GCS publication transport")?,
                ));
                Ok(Storage {
                    files: files.clone(),
                    seed: files,
                })
            }
        }
    }
}
