//! Exact built viewer inventory, loaded once before listening.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::Arc;

use axum::body::Bytes;
use axum::http::HeaderValue;
use mokly_css::imported_assets;
use mokly_model::namespace::{FONT_FACES, viewer};
use mokly_source_interface::tree::{FileKind, SourceTree};
use serde::Deserialize;

use crate::error::{InternalError, Result, ServerError};
use crate::validator;

/// Immutable public response bytes with a fixed MIME type.
#[derive(Clone, Debug)]
pub struct File {
    /// Exact encoded bytes.
    pub bytes: Bytes,
    /// Fixed validated HTTP MIME type.
    pub content_type: String,
}

/// A generated stylesheet with the strong validator of its immutable bytes.
#[derive(Clone)]
pub struct Stylesheet {
    pub(crate) file: File,
    pub(crate) etag: HeaderValue,
}

impl Stylesheet {
    /// Compute the validator before the worker returns this version.
    pub fn new(file: File) -> Result<Self> {
        let etag = validator::bytes(&file.bytes)?;
        Ok(Self { file, etag })
    }
}

/// Package asset loader boundary, separate from authored resources.
#[cfg_attr(test, unimock::unimock(api = ViewerAssetsMock))]
pub trait ViewerAssets: Send + Sync {
    /// Load exactly the browser inventory, shell stylesheet, and packaged fonts.
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
            || !manifest.modules.iter().any(|name| name == "frame-probe.js")
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
        let faces = FONT_FACES.map(|face| (format!("assets/{face}"), face, "font/woff2"));
        for (source, route, mime) in [
            ("shell.css".into(), "shell.css", "text/css; charset=utf-8"),
            (
                "assets/brand.svg".into(),
                "client/brand.svg",
                "image/svg+xml",
            ),
        ]
        .into_iter()
        .chain(faces)
        {
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
    if path.starts_with("static/mokly-generated/assets/")
        && let Some(mime) = imported_assets::content_type(path)
    {
        return mime.into();
    }
    let mime = mime_guess::from_path(path)
        .first_or_octet_stream()
        .to_string();
    if mime.starts_with("text/") || mime == "application/json" {
        format!("{mime}; charset=utf-8")
    } else {
        mime
    }
}

/// Content type of a planned generated resource, with the imported asset table.
pub(crate) fn generated_content_type(path: &str) -> String {
    imported_assets::content_type(path).map_or_else(|| content_type(path), str::to_owned)
}

#[cfg(test)]
#[path = "_tests_/imported_asset_types_tests.rs"]
mod imported_asset_types_tests;
