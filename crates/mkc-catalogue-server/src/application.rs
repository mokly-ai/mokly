//! Catalogue binary composition root and trait-backed server lifecycle.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use mkc_auth::runtime::SystemRuntime;
use mkc_config::catalogue::CatalogueSettings;
use mkc_config::publications::FileStorage;
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::client_origins::AdmittedOrigins;
use mkc_file_store_gcs::credentials::{CredentialsFactory, MetadataCredentialsFactory};
use mkc_file_store_gcs::store::GcsFileStore;
use mkc_file_store_gcs::transport::{HttpFactory, ReqwestHttpFactory};
use mkc_file_store_interface::store::FileStore;
use mkc_file_store_local::directory::{FileStoreFactory, LocalFileStoreFactory};
use mkc_publications::access::CatalogueAccessService;
use mkc_publications::capability::{CapabilityFactory, HmacCapabilityFactory};
use mkc_publications::locations::Locations;
use mkc_publications::policy::DatabaseAccessPolicy;
use mkc_publications::transaction::{StoreTransactions, Transactions};
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime;
use tokio::net::TcpListener;

use crate::cache::{BlobCache, LruBlobCache};
use crate::catalogue::PublishedCatalogue;
use crate::error::{ErrorResultExt, Result};
use crate::http::{CatalogueHandler, Handler};
use crate::router::{RouterBuilder, RouterFactory};

/// Running catalogue server behavior, independent of its composition.
pub trait Application: Send + Sync {
    /// Serve isolated catalogues until process shutdown.
    fn serve(&self) -> Pin<Box<dyn Future<Output = Result<()>> + Send + '_>>;
}

/// Composition factory for standalone or embedded catalogue servers.
pub trait ApplicationFactory {
    /// Apply pending migrations and construct verified dependency boundaries.
    fn create(&self, settings: CatalogueSettings) -> Result<Arc<dyn Application>>;
}

/// Production/development composition selected only by explicit settings.
pub struct SystemApplicationFactory;

struct CatalogueApplication {
    settings: CatalogueSettings,
    origins: AdmittedOrigins,
    handler: Arc<dyn Handler>,
}

impl ApplicationFactory for SystemApplicationFactory {
    fn create(&self, settings: CatalogueSettings) -> Result<Arc<dyn Application>> {
        DieselMigrations
            .migrate(&settings.database_url)
            .context("migrate catalogue database")?;
        let store = PgStoreFactory {
            runtime: Arc::new(runtime::SystemRuntime),
        }
        .connect(&settings.database_url)
        .context("connect catalogue index")?;
        let transactions: Arc<dyn Transactions> = Arc::new(StoreTransactions { store });
        let files: Arc<dyn FileStore> = match &settings.publications.storage {
            FileStorage::Local(root) => LocalFileStoreFactory
                .open(root)
                .context("open catalogue local storage")?,
            FileStorage::Gcs { bucket, prefix } => Arc::new(GcsFileStore::new(
                "https://storage.googleapis.com".to_owned(),
                bucket.clone(),
                prefix.clone(),
                ReqwestHttpFactory
                    .build(
                        MetadataCredentialsFactory
                            .metadata()
                            .context("initialize catalogue workload identity")?,
                    )
                    .context("initialize catalogue GCS HTTP")?,
            )),
        };
        let locations = Locations {
            app_origin: settings.app_origin.clone(),
            catalogue_domain: settings.publications.domain.clone(),
            catalogue_scheme: settings.publications.scheme.clone(),
            catalogue_port: settings.publications.port,
        };
        let access = Arc::new(CatalogueAccessService {
            transactions: transactions.clone(),
            policy: Arc::new(DatabaseAccessPolicy),
            runtime: Arc::new(SystemRuntime),
            capabilities: HmacCapabilityFactory
                .create(&settings.publications.signing_key)
                .context("load catalogue signature key")?,
            locations: locations.clone(),
        });
        let cache: Option<Arc<dyn BlobCache>> =
            LruBlobCache::new(settings.publications.hot_cache_bytes)
                .map(|cache| Arc::new(cache) as Arc<dyn BlobCache>);
        let catalogue = Arc::new(PublishedCatalogue {
            access,
            transactions,
            files,
            cache,
            locations,
        });
        let origins = AdmittedOrigins::new(settings.app_origin.clone(), settings.desktop_client);
        let handler = Arc::new(CatalogueHandler {
            catalogue,
            origins: origins.clone(),
        });
        Ok(Arc::new(CatalogueApplication {
            settings,
            origins,
            handler,
        }))
    }
}

impl Application for CatalogueApplication {
    fn serve(&self) -> Pin<Box<dyn Future<Output = Result<()>> + Send + '_>> {
        Box::pin(async {
            let router = RouterFactory {
                handler: self.handler.clone(),
                origins: self.origins.clone(),
            }
            .build()?;
            let listener = TcpListener::bind(self.settings.publications.bind)
                .await
                .context("bind catalogue listener")?;
            tracing::info!(address = %listener.local_addr().context("read catalogue listener")?, "Catalogue listening");
            axum::serve(listener, router)
                .with_graceful_shutdown(async {
                    if let Err(error) = tokio::signal::ctrl_c().await {
                        tracing::error!(?error, "catalogue shutdown signal failed");
                    }
                })
                .await
                .context("serve isolated catalogues")
        })
    }
}
