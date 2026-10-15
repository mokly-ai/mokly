//! Graph-backed documents and read-time public-file confinement.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use mokly_graph::types::RenderGeneration;
use mokly_model::data::Props;
use mokly_model::namespace::{GENERATED_DIRECTORY, VIEWER_DIRECTORY, generated};
use mokly_model::usage::CatalogueUsage;

use crate::assets::{File, content_type};
use crate::error::{Result, ServerError};
use crate::public_read::PublicReader;

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
    /// Read an already reached authored file through the live confinement boundary.
    fn authored(&self, path: &str) -> Option<File>;
    /// Render complete edited props through the same graph in isolation.
    fn preview(&self, route: &str, props: &Props) -> Result<PreviewDocument>;
}

/// Native graph adapter with one document lock per declared route.
pub struct GraphDocuments {
    /// Immutable graph generation.
    pub generation: Arc<dyn RenderGeneration>,
    /// Confined working-tree reads, separate from captured source bytes.
    pub public: Arc<dyn PublicReader>,
    locks: BTreeMap<String, Mutex<()>>,
}

impl GraphDocuments {
    /// Construct synchronization without starting any render.
    pub fn new(generation: Arc<dyn RenderGeneration>, public: Arc<dyn PublicReader>) -> Self {
        let locks = generation
            .plans()
            .keys()
            .map(|route| (route.clone(), Mutex::new(())))
            .collect();
        Self {
            generation,
            public,
            locks,
        }
    }
}

impl Documents for GraphDocuments {
    fn generated(&self, route: &str) -> Result<Option<File>> {
        if let Some(lock) = self.locks.get(route) {
            let _guard = lock.lock().unwrap_or_else(|error| error.into_inner());
            return match self.generation.render(route) {
                Ok(artifact) => Ok(Some(File {
                    bytes: instrument(&artifact.bytes),
                    content_type: artifact.content_type.clone(),
                })),
                Err(source) => Err(ServerError::Render { source }),
            };
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
    fn authored(&self, path: &str) -> Option<File> {
        if !self.generation.public_files().contains(path) {
            return None;
        }
        self.public.read(path)
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
                bytes: instrument(&rendered.artifact.bytes),
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
        for path in rendered.closure.files {
            let Some(file) = self.public.read(&path) else {
                return Err(ServerError::InvalidAssets);
            };
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

fn instrument(bytes: &[u8]) -> Vec<u8> {
    let text = String::from_utf8_lossy(bytes);
    let script = format!(r#"<script src="/{VIEWER_DIRECTORY}/client/inspector.js"></script>"#);
    if let Some(index) = text.rfind("</body>") {
        format!("{}{script}{}", &text[..index], &text[index..]).into_bytes()
    } else {
        bytes.to_vec()
    }
}
