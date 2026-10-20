//! Sidecar-reported stylesheet metadata enters the same HTML graph path.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_css::types::StylesheetRoot;

use crate::resource_inputs::{MemoryResourceInputs, ResourceInputs};

/// Validated source metadata supplied by a bundle and description adapter.
#[derive(Clone, Debug)]
pub struct DeliveryInputs {
    /// Lazy resource dependencies shared by related graph generations.
    pub resources: Arc<dyn ResourceInputs>,
    /// Authored dependency directories mapped to the bundle's logical root prefixes.
    pub dependency_aliases: BTreeMap<String, String>,
    /// Sidecar bundle generation used by the fragment provider, when JavaScript renders.
    pub fragment_generation: Option<String>,
    /// Renderer and entry-module CSS roots from the module graph.
    pub stylesheet_roots: Vec<StylesheetRoot>,
    /// Component parent path to config-relative declared public CSS, in authored order.
    pub component_stylesheets: BTreeMap<String, Vec<String>>,
    /// Parent definition path to its exporting entry module, independent of attribution.
    pub entry_modules: BTreeMap<String, String>,
}

impl Default for DeliveryInputs {
    fn default() -> Self {
        Self {
            resources: Arc::new(MemoryResourceInputs::default()),
            dependency_aliases: BTreeMap::new(),
            fragment_generation: None,
            stylesheet_roots: Vec::new(),
            component_stylesheets: BTreeMap::new(),
            entry_modules: BTreeMap::new(),
        }
    }
}
