//! Weak route entries share one capture only while requests or responses own it.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex, Weak};

use axum::http::HeaderValue;
use mokly_graph::types::RenderGeneration;

use crate::asset_streams::{
    AssetRequest, AssetResult, AssetStreams, AssetVersion, Capture, SharedAsset,
};
use crate::assets::content_type;
use crate::backend::GraphDocuments;
use crate::error::{Result, ServerError};

struct Request {
    capture: Arc<Capture>,
    generation: Arc<dyn RenderGeneration>,
    streams: Arc<dyn AssetStreams>,
    tags: Arc<Mutex<BTreeMap<String, HeaderValue>>>,
    route: String,
}

impl GraphDocuments {
    pub(crate) fn reserve_asset(&self, route: &str) -> Box<dyn AssetRequest> {
        let capture = {
            let mut copies = self
                .asset_copies
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            copies.retain(|_, copy| copy.strong_count() > 0);
            match copies.get(route).and_then(Weak::upgrade) {
                Some(capture) => capture,
                None => {
                    let capture = Arc::new(Capture::new());
                    copies.insert(route.into(), Arc::downgrade(&capture));
                    capture
                }
            }
        };
        Box::new(Request {
            capture,
            generation: self.generation.clone(),
            streams: self.streams.clone(),
            tags: self.asset_tags.clone(),
            route: route.into(),
        })
    }
}

impl AssetRequest for Request {
    fn capture(self: Box<Self>) -> AssetResult {
        if let Err(source) = self.generation.check_cancelled() {
            return Err(Arc::new(ServerError::Render { source }));
        }
        let result = self.capture.get_or_init(|| match self.verify() {
            Ok(version) => Ok(version.map(Arc::new)),
            Err(error) => Err(Arc::new(error)),
        });
        match result {
            Ok(Some(version)) => {
                if let Err(source) = self.generation.check_cancelled() {
                    return Err(Arc::new(ServerError::Render { source }));
                }
                Ok(Some(SharedAsset {
                    version: version.clone(),
                    _capture: Some(self.capture.clone()),
                }))
            }
            Ok(None) => Ok(None),
            Err(error) => Err(error.clone()),
        }
    }
}

impl Request {
    fn verify(&self) -> Result<Option<AssetVersion>> {
        let mut asset = match self.generation.open_asset(&self.route) {
            Ok(Some(asset)) => asset,
            Ok(None) => return Ok(None),
            Err(source) => return Err(ServerError::Render { source }),
        };
        let opened = self
            .streams
            .capture(asset.as_mut(), &content_type(&self.route))?;
        let tag = self
            .tags
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(&self.route)
            .cloned();
        if let Some(etag) = tag {
            return Ok(Some(AssetVersion::with_tag(opened, etag)));
        }
        let version = AssetVersion::new(opened)?;
        self.tags
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(self.route.clone(), version.etag.clone());
        Ok(Some(version))
    }
}
