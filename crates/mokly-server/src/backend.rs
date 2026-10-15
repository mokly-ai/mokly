//! Graph-backed documents and read-time public-file confinement.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use mokly_graph::cache::Artifact;
use mokly_graph::types::RenderGeneration;
use mokly_model::data::Props;
use mokly_model::namespace::{GENERATED_DIRECTORY, generated};
use mokly_model::usage::CatalogueUsage;

use crate::assets::{File, content_type};
use crate::error::{Result, ServerError};
use crate::preview::MAX_BYTES;
use crate::public_read::{OpenedFile, PublicReader};

/// Encoded preview data before bounded memory admission.
pub struct PreviewDocument {
    /// All paths relative to one render id.
    pub files: BTreeMap<String, File>,
    /// Preview document path inside that bundle.
    pub document: String,
    /// Rendered usage, always ready.
    pub usage: CatalogueUsage,
}

/// Blocking graph work; HTTP runs each call outside its event loop.
#[cfg_attr(test, unimock::unimock(api = DocumentsMock))]
pub trait Documents: Send + Sync {
    /// Read a declared generated document or resource.
    fn generated(&self, route: &str) -> Result<Option<File>>;
    /// Render one background document without copying its response bytes.
    fn background(&self, route: &str) -> Result<()>;
    /// Completed usage, retained separately from evictable document trees.
    fn usage(&self, route: &str) -> Option<CatalogueUsage>;
    /// Read an already reached authored file through the live confinement boundary.
    fn authored(&self, path: &str) -> Option<OpenedFile>;
    /// Render complete edited props through the same graph in isolation.
    fn preview(&self, route: &str, props: &Props) -> Result<PreviewDocument>;
}

/// Native graph adapter with one document lock per declared route.
pub struct GraphDocuments {
    /// Immutable graph generation.
    pub generation: Arc<dyn RenderGeneration>,
    /// Confined working-tree reads, separate from captured source bytes.
    pub public: Arc<dyn PublicReader>,
    locks: BTreeMap<String, Mutex<Option<CatalogueUsage>>>,
}

impl GraphDocuments {
    /// Construct synchronization without starting any render.
    pub fn new(generation: Arc<dyn RenderGeneration>, public: Arc<dyn PublicReader>) -> Self {
        let locks = generation
            .plans()
            .keys()
            .map(|route| (route.clone(), Mutex::new(None)))
            .collect();
        Self {
            generation,
            public,
            locks,
        }
    }
    fn render(&self, route: &str) -> Result<Option<Arc<Artifact>>> {
        let Some(lock) = self.locks.get(route) else {
            return Ok(None);
        };
        let mut usage = lock.lock().unwrap_or_else(|error| error.into_inner());
        match self.generation.render(route) {
            Ok(artifact) => {
                *usage = Some(
                    artifact
                        .document
                        .as_ref()
                        .map_or(CatalogueUsage::Unavailable, |document| {
                            document.usage.clone()
                        }),
                );
                Ok(Some(artifact))
            }
            Err(source) => {
                *usage = Some(CatalogueUsage::Unavailable);
                Err(ServerError::Render { source })
            }
        }
    }
}

impl Documents for GraphDocuments {
    fn generated(&self, route: &str) -> Result<Option<File>> {
        if self.locks.contains_key(route) {
            return Ok(self.render(route)?.map(|artifact| File {
                bytes: artifact.bytes.clone(),
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
                bytes,
                content_type: content_type(route),
            })),
            Err(source) => Err(ServerError::Render { source }),
        }
    }
    fn background(&self, route: &str) -> Result<()> {
        if self.usage(route).is_some() {
            return Ok(());
        }
        self.render(route)?;
        Ok(())
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
            Err(source) => return Err(ServerError::Render { source }),
        };
        let mut files = BTreeMap::new();
        let document = generated(route);
        files.insert(
            document.clone(),
            File {
                bytes: rendered.artifact.bytes.clone(),
                content_type: rendered.artifact.content_type.clone(),
            },
        );
        for resource in rendered
            .closure
            .edges
            .keys()
            .filter_map(|path| path.strip_prefix(&format!("static/{GENERATED_DIRECTORY}/")))
        {
            match self.generation.resource(resource) {
                Ok(Some(bytes)) => {
                    files.insert(
                        generated(resource),
                        File {
                            bytes,
                            content_type: content_type(resource),
                        },
                    );
                }
                Ok(None) => {}
                Err(source) => return Err(ServerError::Render { source }),
            }
        }
        let mut remaining = MAX_BYTES
            .checked_sub(files.values().map(|file| file.bytes.len()).sum())
            .ok_or(ServerError::PreviewCapacity)?;
        for path in rendered.closure.files {
            let Some(file) = self.public.read(&path, remaining)? else {
                return Err(ServerError::PreviewResource);
            };
            remaining = remaining
                .checked_sub(file.bytes.len())
                .ok_or(ServerError::PreviewCapacity)?;
            files.insert(format!("static/{path}"), file);
        }
        let usage = rendered
            .artifact
            .document
            .as_ref()
            .map_or(CatalogueUsage::Unavailable, |document| {
                document.usage.clone()
            });
        Ok(PreviewDocument {
            files,
            document,
            usage,
        })
    }
}
#[cfg(test)]
#[path = "_tests_/backend_tests.rs"]
mod backend_tests;
