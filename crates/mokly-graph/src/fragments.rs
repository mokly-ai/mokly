//! Memoized JavaScript fragment renders share the bounded artifact cache.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use mokly_html::error::{HtmlError, Result};
use mokly_html::fragment::{Fragment, FragmentRenderer, FragmentRequest, RenderKind};
use mokly_model::material::props_key;

use crate::cache::{Artifact, RenderCache};
use crate::key::{NodeKey, NodeKind, key};

/// Adapter around one sidecar bundle generation; consume through `dyn FragmentRenderer`.
pub struct MemoFragments {
    /// Content-addressed sidecar bundle generation, including its module graph.
    pub generation: String,
    /// The actual sidecar rendering boundary.
    pub renderer: Arc<dyn FragmentRenderer>,
    /// Shared byte-bounded process cache.
    pub cache: Arc<dyn RenderCache>,
    flights: Mutex<BTreeMap<NodeKey, Arc<Mutex<()>>>>,
}

impl MemoFragments {
    /// Bind a provider to one immutable sidecar generation.
    pub fn new(
        generation: String,
        renderer: Arc<dyn FragmentRenderer>,
        cache: Arc<dyn RenderCache>,
    ) -> Self {
        Self {
            generation,
            renderer,
            cache,
            flights: Mutex::new(BTreeMap::new()),
        }
    }
}

impl FragmentRenderer for MemoFragments {
    fn render(&self, request: &FragmentRequest) -> Result<Fragment> {
        let props = match props_key(&request.props) {
            Ok(key) => key,
            Err(source) => return Err(HtmlError::Props { source }),
        };
        let axes = format!(
            "{:?}/{:?}/{:?}/{}",
            request.kind, request.viewport, request.color_scheme, request.ignore_enabled
        );
        let slots = request
            .slots
            .iter()
            .map(|(name, token)| format!("{name}:{token}"))
            .collect::<Vec<_>>()
            .join("\n");
        let effective = format!(
            "{}\n{}\n{:?}",
            request.entry_path, request.entry_title, request.saved_slots
        );
        let key = if matches!(&request.kind, RenderKind::Page) {
            key(
                NodeKind::Fragment,
                &[
                    self.generation.as_bytes(),
                    b"page",
                    request.handle.as_bytes(),
                ],
            )
        } else {
            key(
                NodeKind::Fragment,
                &[
                    self.generation.as_bytes(),
                    request.handle.as_bytes(),
                    effective.as_bytes(),
                    props.as_bytes(),
                    axes.as_bytes(),
                    slots.as_bytes(),
                ],
            )
        };
        let flight = {
            let mut flights = self
                .flights
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            flights
                .entry(key.clone())
                .or_insert_with(|| Arc::new(Mutex::new(())))
                .clone()
        };
        let result = {
            let _guard = flight.lock().unwrap_or_else(|error| error.into_inner());
            if let Some(artifact) = self.cache.get(&key)
                && let Some(fragment) = &artifact.fragment
            {
                Ok(fragment.clone())
            } else {
                match self.renderer.render(request) {
                    Ok(fragment) => {
                        self.cache.insert(
                            key.clone(),
                            Arc::new(Artifact {
                                bytes: Vec::new(),
                                document: None,
                                fragment: Some(fragment.clone()),
                                content_type: "text/html; charset=utf-8".into(),
                            }),
                        );
                        Ok(fragment)
                    }
                    Err(source) => Err(source),
                }
            }
        };
        let mut flights = self
            .flights
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if Arc::strong_count(&flight) == 2 {
            flights.remove(&key);
        }
        result
    }
}
