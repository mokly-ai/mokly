//! Catalogue origin, isolated file storage and capability-key configuration.

use std::net::{IpAddr, SocketAddr};
use std::path::PathBuf;

use mkc_file_store_interface::prefix::ObjectPrefix;
use url::Url;

use crate::settings::{EnvironmentConfig, Error, Result};

const DEFAULT_HOT_CACHE_BYTES: u64 = 128 * 1024 * 1024;
const DEFAULT_UPLOAD_MEMORY_BYTES: u64 = 512 * 1024 * 1024;

/// Explicit storage selection, with no implicit production filesystem fallback.
pub enum FileStorage {
    /// Exclusively owned local object directory for development and integration.
    Local(PathBuf),
    /// Private GCS bucket using workload-identity OAuth credentials.
    Gcs {
        /// Private bucket name.
        bucket: String,
        /// Optional namespace applied only to physical GCS object names.
        prefix: Option<ObjectPrefix>,
    },
}

/// Validated shared settings for the API and catalogue server.
pub struct PublicationSettings {
    /// Process-wide bytes retained by authenticated upload bodies.
    pub upload_memory_bytes: u64,
    /// Advertise gzip Blob uploads in Plan responses.
    pub upload_blob_gzip: bool,
    /// Maximum blocking workers used by one publication ingest.
    pub ingest_workers: usize,
    /// Wildcard DNS suffix; actual publications use their own host labels.
    pub domain: String,
    /// HTTPS in production, loopback HTTP in development.
    pub scheme: String,
    /// Optional explicit authority port.
    pub port: Option<u16>,
    /// Catalogue listener, independent of API binding.
    pub bind: SocketAddr,
    /// 256-bit HMAC key in hexadecimal, deliberately omitted from Debug.
    pub signing_key: String,
    /// Explicit byte-store adapter configuration.
    pub storage: FileStorage,
    /// Per-process byte capacity for the catalogue's verified-object cache.
    pub hot_cache_bytes: u64,
}

/// Shared catalogue configuration seam, also used by its standalone binary.
pub trait PublicationConfig {
    /// Read trusted settings and enforce separation from the app origin.
    fn publications(&self, development: bool, app_origin: &str) -> Result<PublicationSettings>;
}

impl PublicationConfig for EnvironmentConfig {
    fn publications(&self, development: bool, app_origin: &str) -> Result<PublicationSettings> {
        let get = |key| {
            self.environment
                .get(key)
                .filter(|value| !value.is_empty())
                .ok_or(Error::Invalid(key))
        };
        let origin = get("MKC_CATALOGUE_ORIGIN")?;
        let url = match Url::parse(&origin) {
            Ok(url) => url,
            Err(_) => return Err(Error::Invalid("MKC_CATALOGUE_ORIGIN")),
        };
        let domain = url
            .host_str()
            .ok_or(Error::Invalid("MKC_CATALOGUE_ORIGIN"))?;
        let local = development && domain == "localhost";
        if !(url.scheme() == "https" || local && url.scheme() == "http")
            || !url.username().is_empty()
            || url.password().is_some()
            || url.path() != "/"
            || url.query().is_some()
            || url.fragment().is_some()
            || domain.len() > 180
            || (!local && !domain.contains('.'))
        {
            return Err(Error::Invalid("MKC_CATALOGUE_ORIGIN"));
        }
        let app = match Url::parse(app_origin) {
            Ok(url) => url,
            Err(_) => return Err(Error::Invalid("MKC_APP_ORIGIN")),
        };
        let app_host = app.host_str().ok_or(Error::Invalid("MKC_APP_ORIGIN"))?;
        if !local && !separate_domains(app_host, domain) {
            return Err(Error::Invalid("MKC_CATALOGUE_ORIGIN"));
        }
        let signing_key = get("MKC_CATALOGUE_SIGNING_KEY")?;
        if signing_key.len() != 64
            || !signing_key
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(Error::Invalid("MKC_CATALOGUE_SIGNING_KEY"));
        }
        let bind = match self
            .environment
            .get("MKC_CATALOGUE_BIND")
            .unwrap_or_else(|| "127.0.0.1:8082".to_owned())
            .parse()
        {
            Ok(bind) => bind,
            Err(_) => return Err(Error::Invalid("MKC_CATALOGUE_BIND")),
        };
        let ingest_workers = match self.environment.get("MKC_INGEST_WORKERS") {
            None => 8,
            Some(value) => match value.parse::<i64>() {
                Ok(value) => value.clamp(1, 32) as usize,
                Err(_) => return Err(Error::Invalid("MKC_INGEST_WORKERS")),
            },
        };
        let upload_memory_bytes = match self.environment.get("MKC_UPLOAD_MEMORY_BYTES") {
            Some(value) => match value.parse::<u64>() {
                Ok(0) | Err(_) => return Err(Error::Invalid("MKC_UPLOAD_MEMORY_BYTES")),
                Ok(value) => value,
            },
            None => DEFAULT_UPLOAD_MEMORY_BYTES,
        };
        let upload_blob_gzip = match self.environment.get("MKC_UPLOAD_BLOB_GZIP").as_deref() {
            None | Some("false") => false,
            Some("true") => true,
            Some(_) => return Err(Error::Invalid("MKC_UPLOAD_BLOB_GZIP")),
        };
        let hot_cache_bytes = match self.environment.get("MKC_CATALOGUE_HOT_CACHE_BYTES") {
            Some(value) => match value.parse() {
                Ok(value) => value,
                Err(_) => return Err(Error::Invalid("MKC_CATALOGUE_HOT_CACHE_BYTES")),
            },
            None => DEFAULT_HOT_CACHE_BYTES,
        };
        let storage = match get("MKC_FILE_STORE")?.as_str() {
            "local" if development => {
                FileStorage::Local(PathBuf::from(get("MKC_FILE_STORE_ROOT")?))
            }
            "gcs" => {
                let bucket = get("MKC_GCS_BUCKET")?;
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
            _ => return Err(Error::Invalid("MKC_FILE_STORE")),
        };
        Ok(PublicationSettings {
            upload_memory_bytes,
            upload_blob_gzip,
            ingest_workers,
            domain: domain.to_owned(),
            scheme: url.scheme().to_owned(),
            port: url.port(),
            bind,
            signing_key,
            storage,
            hot_cache_bytes,
        })
    }
}

/// Require DNS origins in different registrable domains, including private PSL suffixes.
fn separate_domains(app: &str, catalogue: &str) -> bool {
    let app = app.trim_end_matches('.');
    let catalogue = catalogue.trim_end_matches('.');
    if app == catalogue
        || app.ends_with(&format!(".{catalogue}"))
        || catalogue.ends_with(&format!(".{app}"))
        || app.parse::<IpAddr>().is_ok()
        || catalogue.parse::<IpAddr>().is_ok()
    {
        return false;
    }
    matches!((psl::domain_str(app), psl::domain_str(catalogue)),
        (Some(app_domain), Some(catalogue_domain)) if app_domain != catalogue_domain)
}

#[cfg(test)]
#[path = "_tests_/publications/mod.rs"]
mod tests;
