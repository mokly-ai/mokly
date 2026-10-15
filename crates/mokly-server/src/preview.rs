//! Bounded authenticated preview bundles with no expired-id table or disk writes.

use std::collections::{BTreeMap, VecDeque};
use std::sync::{Arc, Mutex};

use hmac::{Hmac, KeyInit, Mac};
use mokly_model::namespace::VIEWER_DIRECTORY;
use mokly_model::usage::CatalogueUsage;
use mokly_model::wire_props::{self, ComponentWireProps};
use serde::Serialize;
use sha2::Sha256;

use crate::assets::File;
use crate::backend::PreviewDocument;
use crate::clock::Clock;
use crate::render_request::Rejection;

/// Successful temporary render response.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderSuccess {
    /// Opaque authenticated bundle id.
    pub render_id: String,
    /// Publication revision from the request.
    pub revision: u64,
    /// Confined document URL under the render id.
    pub preview_url: String,
    /// Complete validated tagged props.
    pub props: ComponentWireProps,
    /// Usage of this temporary document.
    pub usage: CatalogueUsage,
}

/// Preview lookup distinguishes authenticated expiry from foreign ids.
pub enum Lookup {
    /// Exact retained file.
    File(File),
    /// Valid id whose bundle expired or was evicted.
    Expired,
    /// Malformed id, foreign id, or absent path.
    Missing,
}

/// Stateful preview memory boundary.
#[cfg_attr(test, unimock::unimock(api = PreviewStoreMock))]
pub trait PreviewStore: Send + Sync {
    /// Admit all encoded document, metadata, and resource bytes atomically.
    fn insert(
        &self,
        preview: PreviewDocument,
        props: &mokly_model::data::Props,
        revision: u64,
    ) -> Result<RenderSuccess, Rejection>;
    /// Resolve only a file of this exact authenticated bundle.
    fn get(&self, id: &str, path: &str) -> Lookup;
    /// Release all transient bytes during shutdown.
    fn clear(&self);
}

struct Bundle {
    id: String,
    created: u64,
    bytes: usize,
    files: BTreeMap<String, File>,
}
#[derive(Default)]
struct State {
    next: u64,
    bundles: VecDeque<Bundle>,
    bytes: usize,
}

/// Sixteen bundles and 32 MiB, retained for at most five minutes.
pub struct MemoryPreviews {
    /// Injected monotonic time.
    pub clock: Arc<dyn Clock>,
    /// Per-process HMAC key, separate from the render capability token.
    pub secret: String,
    state: Mutex<State>,
}

impl MemoryPreviews {
    /// Create an empty bounded store.
    pub fn new(clock: Arc<dyn Clock>, secret: String) -> Self {
        Self {
            clock,
            secret,
            state: Mutex::new(State::default()),
        }
    }
    fn tag(&self, nonce: &str) -> Option<String> {
        let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(self.secret.as_bytes()) else {
            return None;
        };
        mac.update(nonce.as_bytes());
        Some(
            mac.finalize()
                .into_bytes()
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect(),
        )
    }
    fn valid(&self, id: &str) -> bool {
        let Some((nonce, tag)) = id.split_once('-') else {
            return false;
        };
        nonce.len() == 16
            && nonce.bytes().all(|b| b.is_ascii_hexdigit())
            && self.tag(nonce).as_deref() == Some(tag)
    }
}

impl PreviewStore for MemoryPreviews {
    fn insert(
        &self,
        preview: PreviewDocument,
        props: &mokly_model::data::Props,
        revision: u64,
    ) -> Result<RenderSuccess, Rejection> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.next = state.next.checked_add(1).ok_or(Rejection::Capacity)?;
        let nonce = format!("{:016x}", state.next);
        let id = format!("{nonce}-{}", self.tag(&nonce).ok_or(Rejection::Capacity)?);
        let response = RenderSuccess {
            preview_url: format!(
                "/{VIEWER_DIRECTORY}/components/renders/{id}/{}",
                preview.document
            ),
            render_id: id.clone(),
            revision,
            props: wire_props::encode(props),
            usage: preview.usage,
        };
        let metadata = serde_json::to_vec(&response).map_or(usize::MAX, |bytes| bytes.len());
        let bytes = preview.files.iter().fold(metadata, |sum, (path, file)| {
            sum.saturating_add(path.len())
                .saturating_add(file.bytes.len())
                .saturating_add(file.content_type.len())
        });
        if bytes > 32 * 1024 * 1024 {
            return Err(Rejection::Capacity);
        }
        let now = self.clock.milliseconds();
        while state
            .bundles
            .front()
            .is_some_and(|bundle| now.saturating_sub(bundle.created) >= 300_000)
            || state.bundles.len() >= 16
            || state.bytes > 32 * 1024 * 1024 - bytes
        {
            let Some(bundle) = state.bundles.pop_front() else {
                break;
            };
            state.bytes -= bundle.bytes;
        }
        state.bytes += bytes;
        state.bundles.push_back(Bundle {
            id,
            created: now,
            bytes,
            files: preview.files,
        });
        Ok(response)
    }
    fn get(&self, id: &str, path: &str) -> Lookup {
        if !self.valid(id) {
            return Lookup::Missing;
        }
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let now = self.clock.milliseconds();
        while state
            .bundles
            .front()
            .is_some_and(|bundle| now.saturating_sub(bundle.created) >= 300_000)
        {
            if let Some(bundle) = state.bundles.pop_front() {
                state.bytes -= bundle.bytes;
            }
        }
        let Some(bundle) = state.bundles.iter().find(|bundle| bundle.id == id) else {
            return Lookup::Expired;
        };
        bundle
            .files
            .get(path)
            .cloned()
            .map_or(Lookup::Missing, Lookup::File)
    }
    fn clear(&self) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.bundles.clear();
        state.bytes = 0;
    }
}

#[cfg(test)]
#[path = "_tests_/preview_tests.rs"]
mod preview_tests;
