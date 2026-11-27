//! Authorized immutable static-file resolution with ordinary directory indexes.

use std::sync::Arc;

use axum::http::HeaderValue;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::PublicationId;
use mkc_domain::values::Visibility;
use mkc_file_store_interface::store::FileStore;
use mkc_file_store_interface::stream::{BlobStream, ByteRange};
use mkc_publications::access::CatalogueAccess;
use mkc_publications::error;
use mkc_publications::lifecycle::private_path;
use mkc_publications::locations::Locations;
use mkc_publications::transaction::Transactions;
use mkc_store_interface::blob::PublicationFile;

use crate::cache::BlobCache;
use crate::error::{Error, ErrorResultExt, Result};
use crate::file_response;
use crate::routes::{self, Host};

pub(crate) struct Request {
    pub(crate) host: String,
    pub(crate) path: String,
    pub(crate) query: Option<String>,
    /// Unparsed cookie header, used only when authorization falls back to cookies.
    pub(crate) cookie_header: Option<HeaderValue>,
    /// Capability from a single well-formed Bearer header.
    pub(crate) bearer: Option<String>,
    /// Whether this is a GET navigation into an iframe.
    pub(crate) iframe_navigation: bool,
    pub(crate) range: Option<String>,
    pub(crate) if_range: bool,
    pub(crate) if_none_match: Option<String>,
    pub(crate) head: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum FileFraming {
    Full(u64),
    Partial(ByteRange),
    NotModified(u64),
    Unsatisfiable(u64),
}

#[derive(Clone)]
pub(crate) struct BodyRequest {
    pub(crate) key: BlobKey,
    pub(crate) length: u64,
    pub(crate) range: Option<ByteRange>,
}

pub(crate) enum FileBody {
    Storage(BodyRequest),
    #[cfg(test)]
    Ready(BlobStream),
}

pub(crate) enum Served {
    Redirect {
        status: u16,
        location: String,
    },
    File {
        status: u16,
        body: Option<FileBody>,
        framing: FileFraming,
        content_type: String,
        cache: &'static str,
        etag: String,
        /// Whether the selected representation is the indexed access worker.
        access_worker: bool,
    },
}

#[unimock::unimock(api = [ServeMock, ExchangeMock, OpenMock])]
#[async_trait::async_trait]
pub(crate) trait Catalogue: Send + Sync {
    fn serve(&self, request: Request, clear_cookie: &mut bool) -> Result<Served>;
    fn exchange(&self, host: &str, grant: &str) -> Result<String>;
    async fn open(&self, request: BodyRequest) -> Result<BlobStream>;
}

pub(crate) struct PublishedCatalogue {
    pub(crate) access: Arc<dyn CatalogueAccess>,
    pub(crate) transactions: Arc<dyn Transactions>,
    pub(crate) files: Arc<dyn FileStore>,
    pub(crate) cache: Option<Arc<dyn BlobCache>>,
    pub(crate) locations: Locations,
}

/// Resolve a file by its indexed publication path.
pub(crate) trait FileLookup {
    fn lookup(&self, publication: PublicationId, path: &str) -> Result<Option<PublicationFile>>;
}

#[async_trait::async_trait]
impl Catalogue for PublishedCatalogue {
    fn serve(&self, request: Request, clear_cookie: &mut bool) -> Result<Served> {
        *clear_cookie = false;
        let path = routes::path(&request.path)?;
        let publication = match routes::host(&request.host, &self.locations)? {
            Host::Publication(id) => id,
            Host::Branch(alias) => {
                let publication = match self.access.alias(&alias) {
                    Ok(value) => value,
                    Err(error) => return Err(Error::publication(error)),
                };
                return Ok(Served::Redirect {
                    status: 307,
                    location: format!(
                        "{}{}",
                        self.locations.catalogue(publication.id),
                        routes::with_query(&request.path, request.query.as_deref())
                    ),
                });
            }
        };
        let context = match self.authorize_request(publication, &request, clear_cookie) {
            Ok(value) => value,
            Err(error::Error::Unauthorized) => {
                return self.serve_access_file(publication, &request);
            }
            Err(error) => return Err(Error::publication(error)),
        };
        let mut blob_url = false;
        let mut lookup = if path.is_empty() || path.ends_with('/') {
            format!("{path}index.html")
        } else {
            path.clone()
        };
        let mut required_hash = None;
        if let Some(tail) = path.strip_prefix("__blobs/") {
            if let Some((hash, path)) = tail.split_once('/') {
                required_hash = hash.parse::<BlobHash>().ok();
                if required_hash.is_some() {
                    lookup = path.to_owned();
                    blob_url = true;
                }
            }
            if !blob_url {
                lookup = "mokly-upload.json".to_owned();
            }
        }
        let mut file = self.lookup(publication, &lookup)?;
        if required_hash
            .as_ref()
            .is_some_and(|hash| file.as_ref().is_some_and(|file| &file.key.hash != hash))
        {
            file = None;
        }
        if file.is_none()
            && !path.is_empty()
            && !path.ends_with('/')
            && !blob_url
            && !private_path(&path)
            && !routes::obsolete_path(&path)
            && self
                .lookup(publication, &format!("{path}/index.html"))?
                .is_some()
        {
            return Ok(Served::Redirect {
                status: 308,
                location: routes::with_query(
                    &format!("{}/", request.path),
                    request.query.as_deref(),
                ),
            });
        }
        let (file, status) = match file {
            Some(file) => (file, 200),
            None => (
                self.lookup(publication, "404.html")?
                    .ok_or(Error::NotFound)?,
                404,
            ),
        };
        let cache = if context.project.visibility == Visibility::Private
            || status != 200
            || file
                .path
                .to_ascii_lowercase()
                .starts_with("mokly-viewer/diffs/")
            || *clear_cookie
        {
            "no-store"
        } else if blob_url {
            "public, max-age=31536000, immutable"
        } else {
            "no-cache"
        };
        file_response::select(&request, file, status, cache)
    }

    fn exchange(&self, host: &str, grant: &str) -> Result<String> {
        let Host::Publication(publication) = routes::host(host, &self.locations)? else {
            return Err(Error::NotFound);
        };
        match self.access.exchange(publication, grant) {
            Ok(cookie) => Ok(cookie),
            Err(error) => Err(Error::publication(error)),
        }
    }

    async fn open(&self, request: BodyRequest) -> Result<BlobStream> {
        self.open_body(&request.key, request.length, request.range)
            .await
    }
}

impl FileLookup for PublishedCatalogue {
    fn lookup(&self, publication: PublicationId, path: &str) -> Result<Option<PublicationFile>> {
        if private_path(path) || routes::obsolete_path(path) {
            return Ok(None);
        }
        let mut file = None;
        self.transactions
            .run(true, &mut |queries| {
                file = error::ErrorResultExt::context(
                    queries.publication_file(publication, path),
                    "resolve catalogue path",
                )?;
                Ok(())
            })
            .context("read isolated catalogue index")?;
        Ok(file)
    }
}

#[cfg(test)]
#[path = "_tests_/catalogue_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "_tests_/catalogue_request_tests.rs"]
mod request_tests;

#[cfg(test)]
#[path = "_tests_/namespace_tests.rs"]
mod namespace_tests;
