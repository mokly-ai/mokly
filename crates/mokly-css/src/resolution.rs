//! Consumer-compatible stylesheet resolution settings.

use std::collections::BTreeMap;

/// Pure resolution settings shared with the sidecar's consumer module graph.
#[derive(Clone, Debug, Default)]
pub struct Resolution {
    /// Configuration directory, relative to the repository; empty for its root.
    pub config_directory: String,
    /// Bare aliases, resolved from the configuration directory before package roots.
    pub aliases: BTreeMap<String, String>,
    /// Consumer export conditions, with style and Node defaults added by CSS.
    pub conditions: Vec<String>,
    /// Package fields after style; main and module apply when empty.
    pub main_fields: Vec<String>,
    /// Configured package roots mapped to ordered logical node_modules directories.
    pub dependency_roots: Vec<String>,
    /// Ancestor node_modules directories mapped to their selected logical roots.
    pub dependency_aliases: BTreeMap<String, String>,
    /// Extension lookup order, or the consumer bundler defaults.
    pub extensions: Vec<String>,
}
