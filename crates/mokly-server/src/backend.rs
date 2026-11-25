//! Graph-backed documents and read-time public-file confinement.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex, Weak};

use axum::body::Bytes;
use axum::http::HeaderValue;
use mokly_catalogue::diagnostic::Warning;
use mokly_content_types::delivered_content_type;
use mokly_graph::cache::Artifact;
use mokly_graph::types::RenderGeneration;
use mokly_model::data::Props;
use mokly_model::usage::CatalogueUsage;

use crate::asset_streams::{AssetRequest, AssetStreams, Capture};
use crate::assets::{File, Stylesheet};
use crate::authored_assets::AuthoredAssets;
pub use crate::authored_assets::AuthoredRequest;
use crate::backend_preview::ArtifactBytes;
use crate::background_read::BackgroundRead;
use crate::error::{Result, ServerError};
use crate::public_read::PublicReader;
use crate::validator::Fingerprint;
use crate::warnings::RenderWarnings;

/// Encoded preview data before bounded memory admission.
pub struct PreviewDocument {
    /// All paths relative to one render id.
    pub files: BTreeMap<String, File>,
    /// Preview document path inside that bundle.
    pub document: String,
    /// Rendered usage, always ready.
    pub usage: CatalogueUsage,
}

/// Graph work; HTTP runs IO outside its event loop.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DocumentsMock))]
pub trait Documents: Send + Sync {
    /// Complete the real worker read or return only a deferred miss.
    fn background_read(&self, _route: &str) -> Result<Option<BackgroundRead>> {
        Ok(None)
    }
    /// Read a declared generated document.
    fn generated(&self, route: &str) -> Result<Option<File>>;
    /// Read a rendered stylesheet and prepare its validator.
    fn stylesheet(&self, route: &str) -> Result<Option<Stylesheet>>;
    /// Reserve shared storage with no IO before foreground worker admission.
    fn asset_request(&self, route: &str) -> Box<dyn AssetRequest>;
    /// Render one background document without copying its response bytes. Its warnings
    /// return unreported, and a failure keeps them, so the usage pass reports them in
    /// catalogue order through [`Documents::report`].
    fn background(&self, route: &str) -> Result<Vec<Warning>>;
    /// Deliver a background render's warnings to the attempt that owns this backend.
    fn report(&self, warnings: &[Warning], failed: bool);
    /// Completed usage, retained separately from evictable document trees.
    fn usage(&self, route: &str) -> Option<CatalogueUsage>;
    /// Check public membership and reserve admission for a fresh authored read.
    fn authored_request(&self, path: String) -> Option<AuthoredRequest>;
    /// Render complete edited props through the shared graph without saving the document.
    fn preview(&self, route: &str, props: &Props) -> Result<PreviewDocument>;
}

/// Native graph adapter with one document lock per declared route.
pub struct GraphDocuments {
    /// Immutable graph generation.
    pub generation: Arc<dyn RenderGeneration>,
    /// Confined working-tree reads, separate from captured source bytes.
    pub public: Arc<dyn PublicReader>,
    /// Verified-capture boundary used after foreground admission.
    pub(crate) streams: Arc<dyn AssetStreams>,
    warnings: Arc<dyn RenderWarnings>,
    pub(crate) locks: BTreeMap<String, Arc<Mutex<Option<CatalogueUsage>>>>,
    /// Only live requests and responses own the capture and its temporary file.
    pub(crate) asset_copies: Mutex<BTreeMap<String, Weak<Capture>>>,
    stylesheets: Mutex<BTreeMap<String, StylesheetSlot>>,
    authored_assets: AuthoredAssets,
}

type StylesheetSlot = Arc<Mutex<Option<StylesheetRecord>>>;

struct StylesheetRecord {
    fingerprint: Fingerprint,
    etag: HeaderValue,
}

impl GraphDocuments {
    /// Construct synchronization without starting any render.
    pub fn new(
        generation: Arc<dyn RenderGeneration>,
        public: Arc<dyn PublicReader>,
        warnings: Arc<dyn RenderWarnings>,
        streams: Arc<dyn AssetStreams>,
    ) -> Self {
        let locks = generation
            .plans()
            .keys()
            .map(|route| (route.clone(), Arc::new(Mutex::new(None))))
            .collect();
        Self {
            generation,
            public,
            streams,
            warnings,
            locks,
            asset_copies: Mutex::new(BTreeMap::new()),
            stylesheets: Mutex::default(),
            authored_assets: AuthoredAssets::default(),
        }
    }
    /// Render a declared route and record its usage. A foreground render reports its
    /// warnings here; a background render leaves them to the usage pass.
    fn render(&self, route: &str, report: bool) -> Result<Option<Arc<Artifact>>> {
        let Some(lock) = self.locks.get(route) else {
            return Ok(None);
        };
        let mut usage = lock.lock().unwrap_or_else(|error| error.into_inner());
        let rendered = self.generation.render(route);
        match rendered {
            Ok(artifact) => {
                if let Some(document) = &artifact.document
                    && report
                {
                    self.warnings.report(&document.warnings, false);
                }
                if usage.is_none() {
                    *usage = Some(
                        artifact
                            .document
                            .as_ref()
                            .map_or(CatalogueUsage::Unavailable, |document| {
                                document.usage.clone()
                            }),
                    );
                }
                Ok(Some(artifact))
            }
            Err(source) => {
                if report {
                    self.warnings.report(&source.warnings(), true);
                }
                usage.get_or_insert(CatalogueUsage::Unavailable);
                Err(ServerError::Render { source })
            }
        }
    }
}

impl Documents for GraphDocuments {
    fn background_read(&self, route: &str) -> Result<Option<BackgroundRead>> {
        self.read_background(route).map(Some)
    }

    fn asset_request(&self, route: &str) -> Box<dyn AssetRequest> {
        self.reserve_asset(route)
    }

    fn generated(&self, route: &str) -> Result<Option<File>> {
        Ok(self.render(route, true)?.map(|artifact| File {
            bytes: Bytes::from_owner(ArtifactBytes(artifact.clone())),
            content_type: artifact.content_type.clone(),
        }))
    }
    fn stylesheet(&self, route: &str) -> Result<Option<Stylesheet>> {
        self.read_stylesheet(route)
    }
    fn background(&self, route: &str) -> Result<Vec<Warning>> {
        self.background_document(route)
    }
    fn report(&self, warnings: &[Warning], failed: bool) {
        self.warnings.report(warnings, failed);
    }
    fn usage(&self, route: &str) -> Option<CatalogueUsage> {
        self.locks
            .get(route)?
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
    }
    fn authored_request(&self, path: String) -> Option<AuthoredRequest> {
        if !self.generation.contains_public_file(&path) {
            return None;
        }
        Some(self.authored_assets.reserve(path, self.public.clone()))
    }
    fn preview(&self, route: &str, props: &Props) -> Result<PreviewDocument> {
        let rendered = match self.generation.render_props(route, props) {
            Ok(rendered) => rendered,
            Err(source) => {
                self.warnings.report(&source.warnings(), true);
                return Err(ServerError::Render { source });
            }
        };
        let artifact = rendered.artifact.clone();
        let result = self.preview_document(route, rendered);
        let warnings = artifact
            .document
            .as_ref()
            .map_or(&[][..], |document| document.warnings.as_slice());
        self.warnings.report(warnings, result.is_err());
        result
    }
}

impl GraphDocuments {
    fn read_stylesheet(&self, route: &str) -> Result<Option<Stylesheet>> {
        let slot = {
            let mut files = self
                .stylesheets
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            if let Some(slot) = files.get(route) {
                slot.clone()
            } else if self.has_resource(route) {
                files.entry(route.to_owned()).or_default().clone()
            } else {
                return Ok(None);
            }
        };
        let Some(file) = self.read_resource(route)? else {
            return Ok(None);
        };
        let fingerprint = Fingerprint::of_bytes(&file.bytes);
        let mut current = slot.lock().unwrap_or_else(|error| error.into_inner());
        if let Some(record) = current.as_ref()
            && record.fingerprint == fingerprint
        {
            return Ok(Some(Stylesheet {
                file,
                etag: record.etag.clone(),
            }));
        }
        let stylesheet = Stylesheet::new(file)?;
        *current = Some(StylesheetRecord {
            fingerprint,
            etag: stylesheet.etag.clone(),
        });
        Ok(Some(stylesheet))
    }

    fn has_resource(&self, route: &str) -> bool {
        self.generation
            .resource_routes()
            .iter()
            .any(|known| known == route)
    }

    fn read_resource(&self, route: &str) -> Result<Option<File>> {
        match self.generation.resource(route) {
            Ok(bytes) => Ok(bytes.map(|bytes| File {
                bytes: bytes.into(),
                content_type: delivered_content_type(route),
            })),
            Err(source) => Err(ServerError::Render { source }),
        }
    }

    fn background_document(&self, route: &str) -> Result<Vec<Warning>> {
        if self.locks.get(route).is_some_and(|state| {
            state
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .is_some()
        }) {
            return Ok(Vec::new());
        }
        Ok(self
            .render(route, false)?
            .and_then(|artifact| {
                artifact
                    .document
                    .as_ref()
                    .map(|document| document.warnings.clone())
            })
            .unwrap_or_default())
    }
}
#[cfg(test)]
#[path = "_tests_/backend_tests.rs"]
mod backend_tests;

#[cfg(test)]
#[path = "_tests_/warning_hook_tests.rs"]
mod warning_hook_tests;

#[cfg(test)]
#[path = "_tests_/shared_asset_failure_tests.rs"]
mod shared_asset_failure_tests;
