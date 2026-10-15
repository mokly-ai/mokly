//! Consumer-compatible stylesheet resolution settings.

use std::collections::BTreeMap;

/// Pure resolution settings shared with the sidecar's consumer module graph.
#[derive(Clone, Debug, Default)]
pub struct Resolution {
    /// Configuration directory, relative to the repository; empty for its root.
    pub config_directory: String,
    /// Bare aliases, applied before resolving from the importer.
    pub aliases: BTreeMap<String, String>,
    /// Consumer export conditions, with style and Node defaults added by CSS.
    pub conditions: Vec<String>,
    /// Package fields after style; main and module apply when empty.
    pub main_fields: Vec<String>,
    /// Extra package roots, already repository-relative.
    pub package_roots: Vec<String>,
    /// Selected logical dependency directories that already name node_modules.
    pub dependency_roots: Vec<String>,
    /// Extension lookup order, or the consumer bundler defaults.
    pub extensions: Vec<String>,
}
