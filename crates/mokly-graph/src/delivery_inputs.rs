//! Sidecar-reported stylesheet metadata enters the same HTML graph path.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_css::types::StylesheetRoot;

use crate::public_inputs::{ClosureInputs, MemoryClosureInputs};
use crate::render_inputs::RenderKeys;
use crate::resource_inputs::{MemoryResourceInputs, ResourceInputs};

/// Validated source metadata supplied by a bundle and description adapter.
#[derive(Clone, Debug)]
pub struct DeliveryInputs {
    /// Lazy resource dependencies shared by related graph generations.
    pub resources: Arc<dyn ResourceInputs>,
    /// Authored closure files shared by equal document keys across generations.
    pub closures: Arc<dyn ClosureInputs>,
    /// Authored dependency directories mapped to the bundle's logical root prefixes.
    pub dependency_aliases: BTreeMap<String, String>,
    /// Render input keys of the sidecar bundle's entry modules, when JavaScript renders.
    pub render_keys: Option<Arc<RenderKeys>>,
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
            closures: Arc::new(MemoryClosureInputs::default()),
            dependency_aliases: BTreeMap::new(),
            render_keys: None,
            stylesheet_roots: Vec::new(),
            component_stylesheets: BTreeMap::new(),
            entry_modules: BTreeMap::new(),
        }
    }
}
