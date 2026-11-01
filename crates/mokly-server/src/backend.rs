//! Graph-backed documents and read-time public-file confinement.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex, Weak};

use axum::body::Bytes;
use mokly_catalogue::diagnostic::Warning;
use mokly_graph::cache::Artifact;
use mokly_graph::types::RenderGeneration;
use mokly_model::data::Props;
use mokly_model::usage::CatalogueUsage;

use crate::asset_streams::{AssetRequest, AssetResult, AssetStreams, Capture};
use crate::assets::{File, content_type};
use crate::backend_preview::ArtifactBytes;
use crate::error::{Result, ServerError};
use crate::public_read::{OpenedFile, PublicReader};
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
    /// Read a declared generated document or resource.
    fn generated(&self, route: &str) -> Result<Option<File>>;
    /// Verify and spool a generated opaque asset before streaming its response.
    fn asset(&self, _route: &str) -> AssetResult {
        Ok(None)
    }
    /// Reserve shared storage with no IO before foreground worker admission.
    /// Backends without reservations return None and use `asset` instead.
    fn asset_request(&self, _route: &str) -> Option<Box<dyn AssetRequest>> {
        None
    }
    /// Render one background document without copying its response bytes. Its warnings
    /// return unreported, and a failure keeps them, so the usage pass reports them in
    /// catalogue order through [`Documents::report`].
    fn background(&self, route: &str) -> Result<Vec<Warning>>;
    /// Deliver a background render's warnings to the attempt that owns this backend.
    fn report(&self, warnings: &[Warning], failed: bool);
    /// Completed usage, retained separately from evictable document trees.
    fn usage(&self, route: &str) -> Option<CatalogueUsage>;
    /// Read an already reached authored file through the live confinement boundary.
    fn authored(&self, path: &str) -> Option<OpenedFile>;
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
    locks: BTreeMap<String, Mutex<Option<CatalogueUsage>>>,
    /// Only live requests and responses own the capture and its temporary file.
    pub(crate) asset_copies: Mutex<BTreeMap<String, Weak<Capture>>>,
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
            .map(|route| (route.clone(), Mutex::new(None)))
            .collect();
        Self {
            generation,
            public,
            streams,
            warnings,
            locks,
            asset_copies: Mutex::new(BTreeMap::new()),
        }
    }
    /// Render a declared route and record its usage. A foreground render reports its
    /// warnings here; a background render leaves them to the usage pass.
    fn render(&self, route: &str, report: bool) -> Result<Option<Arc<Artifact>>> {
        let Some(lock) = self.locks.get(route) else {
            return Ok(None);
        };
        let mut usage = lock.lock().unwrap_or_else(|error| error.into_inner());
        match self.generation.render(route) {
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
    fn asset(&self, route: &str) -> AssetResult {
        self.reserve_asset(route).capture()
    }
    fn asset_request(&self, route: &str) -> Option<Box<dyn AssetRequest>> {
        Some(self.reserve_asset(route))
    }

    fn generated(&self, route: &str) -> Result<Option<File>> {
        if self.locks.contains_key(route) {
            return Ok(self.render(route, true)?.map(|artifact| File {
                bytes: Bytes::from_owner(ArtifactBytes(artifact.clone())),
                content_type: artifact.content_type.clone(),
            }));
        }
        if !self
            .generation
            .resource_routes()
            .iter()
            .any(|known| known == route)
        {
            return Ok(None);
        }
        match self.generation.resource(route) {
            Ok(bytes) => Ok(bytes.map(|bytes| File {
                bytes: bytes.into(),
                content_type: content_type(route),
            })),
            Err(source) => Err(ServerError::Render { source }),
        }
    }
    fn background(&self, route: &str) -> Result<Vec<Warning>> {
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
    fn authored(&self, path: &str) -> Option<OpenedFile> {
        if !self.generation.contains_public_file(path) {
            return None;
        }
        self.public.open(path)
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
#[cfg(test)]
#[path = "_tests_/backend_tests.rs"]
mod backend_tests;

#[cfg(test)]
#[path = "_tests_/warning_hook_tests.rs"]
mod warning_hook_tests;

#[cfg(test)]
#[path = "_tests_/shared_asset_failure_tests.rs"]
mod shared_asset_failure_tests;
