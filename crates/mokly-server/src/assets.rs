//! Exact built viewer inventory, loaded once before listening.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::Arc;

use axum::body::Bytes;
use mokly_model::namespace::viewer;
use mokly_source_interface::tree::{FileKind, SourceTree};
use serde::Deserialize;

use crate::error::{InternalError, Result, ServerError};

/// Immutable public response bytes with a fixed MIME type.
#[derive(Clone, Debug)]
pub struct File {
    /// Exact encoded bytes.
    pub bytes: Bytes,
    /// Fixed validated HTTP MIME type.
    pub content_type: String,
}

/// Package asset loader boundary, separate from authored resources.
#[cfg_attr(test, unimock::unimock(api = ViewerAssetsMock))]
pub trait ViewerAssets: Send + Sync {
    /// Load exactly the browser inventory, shell stylesheet, and packaged font.
    fn load(&self, dist: &Path) -> Result<BTreeMap<String, File>>;
}

/// Viewer package assets read through the source-tree interface.
pub struct PackageAssets {
    /// Injected filesystem implementation.
    pub tree: Arc<dyn SourceTree>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Manifest {
    schema_version: u32,
    modules: Vec<String>,
}

impl ViewerAssets for PackageAssets {
    fn load(&self, dist: &Path) -> Result<BTreeMap<String, File>> {
        let bytes = match self.tree.read(&dist.join("browser.manifest.json")) {
            Ok(bytes) => bytes,
            Err(_) => return Err(ServerError::InvalidAssets),
        };
        let manifest: Manifest = match serde_json::from_slice(&bytes) {
            Ok(manifest) => manifest,
            Err(source) => return Err(InternalError::Json { source }.into()),
        };
        if manifest.schema_version != 1
            || !manifest.modules.iter().any(|name| name == "shell.js")
            || !manifest.modules.iter().any(|name| name == "inspector.js")
        {
            return Err(ServerError::InvalidAssets);
        }
        let children = match self.tree.children(&dist.join("browser")) {
            Ok(children) => children,
            Err(_) => return Err(ServerError::InvalidAssets),
        };
        if children.iter().any(|child| child.kind != FileKind::File)
            || children
                .iter()
                .map(|child| &child.name)
                .collect::<BTreeSet<_>>()
                != manifest.modules.iter().collect::<BTreeSet<_>>()
        {
            return Err(ServerError::InvalidAssets);
        }
        let mut routes = BTreeMap::new();
        for name in manifest.modules {
            if !name.ends_with(".js") || name.contains(['/', '\\', ':']) || name.starts_with('.') {
                return Err(ServerError::InvalidAssets);
            }
            if routes.contains_key(&viewer(&format!("client/{name}"))) {
                return Err(ServerError::InvalidAssets);
            }
            let bytes = match self.tree.read(&dist.join("browser").join(&name)) {
                Ok(bytes) => bytes,
                Err(_) => return Err(ServerError::InvalidAssets),
            };
            routes.insert(
                viewer(&format!("client/{name}")),
                File {
                    bytes: bytes.into(),
                    content_type: "text/javascript; charset=utf-8".into(),
                },
            );
        }
        for (source, route, mime) in [
            ("shell.css", "shell.css", "text/css; charset=utf-8"),
            ("assets/brand.svg", "client/brand.svg", "image/svg+xml"),
            (
                "assets/fonts/InterVariable.woff2",
                "fonts/InterVariable.woff2",
                "font/woff2",
            ),
        ] {
            let bytes = match self.tree.read(&dist.join(source)) {
                Ok(bytes) => bytes,
                Err(_) => return Err(ServerError::InvalidAssets),
            };
            routes.insert(
                viewer(route),
                File {
                    bytes: bytes.into(),
                    content_type: mime.into(),
                },
            );
        }
        Ok(routes)
    }
}

/// MIME fallback for public authored files; never use a caller-supplied type.
pub fn content_type(path: &str) -> String {
    let mime = mime_guess::from_path(path)
        .first_or_octet_stream()
        .to_string();
    if mime.starts_with("text/") || mime == "application/json" {
        format!("{mime}; charset=utf-8")
    } else {
        mime
    }
}
