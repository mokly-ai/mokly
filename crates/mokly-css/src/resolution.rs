//! Consumer-compatible stylesheet resolution settings.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use mokly_source_interface::tree::SourceTree;

use crate::{paths, workspace_sources};

/// Workspace source overrides from one configuration. A value of `None` ends layout lookup.
pub type SourcePackages = BTreeMap<String, Option<BTreeMap<String, String>>>;

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
    /// Workspace source overrides in layout order.
    pub source_packages: Vec<SourcePackages>,
}

impl Resolution {
    /// Find the source that a missing workspace build file can recover.
    pub fn workspace_source(
        &self,
        tree: &dyn SourceTree,
        root: &Path,
        target: &Path,
    ) -> Option<PathBuf> {
        workspace_sources::source(tree, root, target, self)
    }

    /// Return the package name when a layout can apply to the package target.
    pub fn workspace_override_hint(
        &self,
        tree: &dyn SourceTree,
        root: &Path,
        target: &Path,
    ) -> Option<String> {
        workspace_sources::override_hint(tree, root, target, self)
    }

    /// Tell whether an already resolved CSS import used package lookup.
    pub(crate) fn is_package_import(&self, importer: &str, specifier: &str, target: &str) -> bool {
        if specifier.starts_with(['.', '/']) {
            return false;
        }
        if self.aliases.keys().any(|alias| {
            specifier == alias
                || specifier
                    .strip_prefix(alias)
                    .is_some_and(|tail| tail.starts_with('/'))
        }) {
            return true;
        }
        // Bare CSS paths also try the importing directory before searching packages.
        let local = paths::resolve(importer, specifier);
        let suffix = local.as_deref().and_then(|path| target.strip_prefix(path));
        !suffix.is_some_and(|suffix| {
            suffix.is_empty()
                || suffix == "/index.css"
                || self.extension_order().any(|extension| extension == suffix)
        })
    }

    /// Extensions in the consumer's lookup order.
    pub(crate) fn extension_order(&self) -> impl Iterator<Item = &str> {
        let defaults = [".tsx", ".ts", ".jsx", ".js", ".css", ".json"];
        self.extensions
            .is_empty()
            .then_some(defaults)
            .into_iter()
            .flatten()
            .chain(self.extensions.iter().map(String::as_str))
    }
}
