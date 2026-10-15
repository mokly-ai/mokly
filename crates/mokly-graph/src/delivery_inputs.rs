//! Sidecar-reported stylesheet metadata enters the same HTML graph path.

use std::collections::BTreeMap;

use mokly_css::types::StylesheetRoot;

/// Validated source metadata supplied by a bundle and description adapter.
#[derive(Clone, Debug, Default)]
pub struct DeliveryInputs {
    /// Sidecar bundle generation used by the fragment provider, when JavaScript renders.
    pub fragment_generation: Option<String>,
    /// Renderer and entry-module CSS roots from the module graph.
    pub stylesheet_roots: Vec<StylesheetRoot>,
    /// Component parent path to config-relative declared public CSS, in authored order.
    pub component_stylesheets: BTreeMap<String, Vec<String>>,
    /// Parent definition path to its exporting entry module, independent of attribution.
    pub entry_modules: BTreeMap<String, String>,
}
