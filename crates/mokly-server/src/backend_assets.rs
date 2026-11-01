//! Weak route entries share one capture only while requests or responses own it.

use std::sync::{Arc, Weak};

use mokly_graph::types::RenderGeneration;

use crate::asset_streams::{AssetRequest, AssetResult, AssetStreams, Capture, SharedAsset};
use crate::assets::content_type;
use crate::backend::GraphDocuments;
use crate::error::{Result, ServerError};
use crate::public_read::OpenedFile;

struct Request {
    capture: Arc<Capture>,
    generation: Arc<dyn RenderGeneration>,
    streams: Arc<dyn AssetStreams>,
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
            Ok(opened) => Ok(opened.map(Arc::new)),
            Err(error) => Err(Arc::new(error)),
        });
        match result {
            Ok(Some(opened)) => {
                if let Err(source) = self.generation.check_cancelled() {
                    return Err(Arc::new(ServerError::Render { source }));
                }
                Ok(Some(SharedAsset {
                    opened: opened.clone(),
                    _capture: self.capture.clone(),
                }))
            }
            Ok(None) => Ok(None),
            Err(error) => Err(error.clone()),
        }
    }
}

impl Request {
    fn verify(&self) -> Result<Option<OpenedFile>> {
        let mut asset = match self.generation.open_asset(&self.route) {
            Ok(Some(asset)) => asset,
            Ok(None) => return Ok(None),
            Err(source) => return Err(ServerError::Render { source }),
        };
        self.streams
            .capture(asset.as_mut(), &content_type(&self.route))
            .map(Some)
    }
}
