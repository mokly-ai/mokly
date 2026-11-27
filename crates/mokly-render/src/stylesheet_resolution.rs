//! Translate one render side's module resolution settings for the CSS compiler.

use mokly_compare::ancestor_roots;
use mokly_css::resolution::Resolution;
use mokly_sidecar::methods::source_packages::SourcePackage;

use crate::side::{SideInputs, dependency_roots};

/// Keep package layouts in the same order for module and stylesheet lookup.
pub(crate) fn resolution(side: &SideInputs) -> Resolution {
    let module_resolution = &side.module_resolution;
    Resolution {
        config_directory: side.configuration_directory.clone(),
        dependency_aliases: side.dependency_aliases.clone(),
        aliases: module_resolution.aliases.clone(),
        conditions: module_resolution.conditions.clone(),
        main_fields: module_resolution.main_fields.clone(),
        dependency_roots: (0..dependency_roots(side).len())
            .map(ancestor_roots::logical)
            .collect(),
        extensions: module_resolution.resolve_extensions.clone(),
        source_packages: module_resolution
            .source_packages
            .iter()
            .map(|packages| {
                packages
                    .iter()
                    .map(|(name, entry)| {
                        let folders = match entry {
                            SourcePackage::Disabled => None,
                            SourcePackage::Folders(folders) => Some(folders.clone()),
                        };
                        (name.clone(), folders)
                    })
                    .collect()
            })
            .collect(),
    }
}

#[cfg(test)]
#[path = "_tests_/stylesheet_resolution_tests.rs"]
mod stylesheet_resolution_tests;
