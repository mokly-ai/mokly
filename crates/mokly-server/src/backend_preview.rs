//! Temporary previews copy a rendered document and its reached resources into one bundle.

use std::collections::BTreeMap;
use std::sync::Arc;

use axum::body::Bytes;
use mokly_graph::cache::Artifact;
use mokly_graph::types::TemporaryDocument;
use mokly_model::namespace::{GENERATED_DIRECTORY, generated};
use mokly_model::usage::CatalogueUsage;

use crate::assets::{File, content_type};
use crate::backend::{GraphDocuments, PreviewDocument};
use crate::error::{Result, ServerError};
use crate::preview::MAX_BYTES;

impl GraphDocuments {
    /// Assemble a preview bundle within the preview store's byte budget.
    pub(crate) fn preview_document(
        &self,
        route: &str,
        rendered: TemporaryDocument,
    ) -> Result<PreviewDocument> {
        let mut files = BTreeMap::new();
        let document = generated(route);
        files.insert(
            document.clone(),
            File {
                bytes: Bytes::from_owner(ArtifactBytes(rendered.artifact.clone())),
                content_type: rendered.artifact.content_type.clone(),
            },
        );
        let mut remaining = MAX_BYTES
            .checked_sub(files.values().map(|file| file.bytes.len()).sum())
            .ok_or(ServerError::PreviewCapacity)?;
        for resource in rendered
            .closure
            .edges
            .keys()
            .filter_map(|path| path.strip_prefix(&format!("static/{GENERATED_DIRECTORY}/")))
        {
            let bytes = if resource.starts_with("assets/") {
                match self.generation.open_asset(resource) {
                    Ok(Some(mut asset)) => {
                        if asset.length() > remaining as u64 {
                            return Err(ServerError::PreviewCapacity);
                        }
                        asset.read_bytes().map(Some)
                    }
                    Ok(None) => self.generation.resource(resource),
                    Err(source) => return Err(ServerError::Render { source }),
                }
            } else {
                self.generation.resource(resource)
            };
            match bytes {
                Ok(Some(bytes)) => {
                    remaining = remaining
                        .checked_sub(bytes.len())
                        .ok_or(ServerError::PreviewCapacity)?;
                    files.insert(
                        generated(resource),
                        File {
                            bytes: bytes.into(),
                            content_type: content_type(resource),
                        },
                    );
                }
                Ok(None) => {}
                Err(source) => return Err(ServerError::Render { source }),
            }
        }
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

/// Shares an artifact's bytes with a response body without copying them.
pub(crate) struct ArtifactBytes(pub(crate) Arc<Artifact>);

impl AsRef<[u8]> for ArtifactBytes {
    fn as_ref(&self) -> &[u8] {
        &self.0.bytes
    }
}
