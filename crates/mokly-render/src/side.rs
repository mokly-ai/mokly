//! Side-specific roots and retained base preparation leases.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_compare::ancestor_roots;
use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::Resolved;
use mokly_sidecar::methods::ModuleResolution;

use crate::error::{Result, convert};

/// A base extraction and its selected dependency tier stay leased together.
pub struct BaseSide {
    /// Extracted immutable source root.
    pub sources: Lease,
    /// Selected dependencies, repository mappings, and optional install lease.
    pub dependencies: Resolved,
    /// Pinned commit identity used for the stylesheet context.
    pub identity: String,
}

/// Concrete source and resolution inputs for one immutable stylesheet context.
#[derive(Clone, Debug)]
pub struct SideInputs {
    /// Working checkout or leased base extraction.
    pub source_root: PathBuf,
    /// Physical roots mapped to this side's source copy.
    pub repository_roots: Vec<PathBuf>,
    /// Selected third-party dependency resolution.
    pub module_resolution: ModuleResolution,
    /// Configuration directory relative to the source root.
    pub configuration_directory: String,
    /// Fresh per-attempt stylesheet context.
    pub context: String,
    pub(crate) dependency_aliases: BTreeMap<String, String>,
    pub(crate) dependency_roots: Vec<PathBuf>,
}

pub(crate) fn inputs(
    config: &ResolvedConfig,
    base: Option<&Arc<BaseSide>>,
    sequence: u64,
) -> Result<SideInputs> {
    let directory = config.file.parent().unwrap_or(&config.repo_root);
    let configuration_directory = relative(directory, &config.repo_root);
    let authored = config.input.module_resolution.clone().unwrap_or_default();
    let mut resolution = ModuleResolution {
        dependency_root: Some(config.repo_root.to_string_lossy().into_owned()),
        aliases: authored.aliases.clone().unwrap_or_default(),
        conditions: authored.conditions.clone().unwrap_or_default(),
        loaders: convert(&authored.loaders.clone().unwrap_or_default())?,
        main_fields: authored.main_fields.clone().unwrap_or_default(),
        package_roots: Vec::new(),
        resolve_extensions: authored.resolve_extensions.clone().unwrap_or_default(),
    };
    resolution.package_roots = ancestor_roots::directories(&configuration_directory)
        .iter()
        .map(|root| {
            if root.is_empty() {
                config.repo_root.clone()
            } else {
                config.repo_root.join(root)
            }
            .to_string_lossy()
            .into_owned()
        })
        .chain(
            authored
                .package_roots
                .unwrap_or_default()
                .iter()
                .map(|root| directory.join(root).to_string_lossy().into_owned()),
        )
        .collect();
    let (source_root, repository_roots, module_resolution, identity) = match base {
        Some(base) => (
            base.sources.directory.clone(),
            base.dependencies.repository_roots.clone(),
            base.dependencies.module_resolution.clone(),
            base.identity.as_str(),
        ),
        None => (
            config.repo_root.clone(),
            vec![config.repo_root.clone()],
            resolution,
            "head",
        ),
    };
    let selected_roots = selected_roots(&source_root, &module_resolution);
    Ok(SideInputs {
        dependency_roots: selected_roots,
        dependency_aliases: BTreeMap::new(),
        source_root,
        repository_roots,
        module_resolution,
        configuration_directory,
        context: format!("{identity}:{}:{sequence}", config.file.display()),
    })
}

/// Selected dependency roots in the sidecar's logical root order.
pub(crate) fn dependency_roots(side: &SideInputs) -> Vec<PathBuf> {
    side.dependency_roots.clone()
}

fn selected_roots(source_root: &Path, resolution: &ModuleResolution) -> Vec<PathBuf> {
    resolution
        .package_roots
        .iter()
        .map(|root| {
            let path = source_root.join(root);
            if path.file_name().is_some_and(|name| name == "node_modules") {
                path
            } else {
                path.join("node_modules")
            }
        })
        .collect()
}

impl SideInputs {
    pub(crate) fn logical_dependency(&self, path: &Path) -> Option<String> {
        self.dependency_roots
            .iter()
            .enumerate()
            .find_map(|(index, root)| {
                path.strip_prefix(root).ok().map(|relative| {
                    format!(
                        "{}/{}",
                        ancestor_roots::logical(index),
                        relative.to_string_lossy().replace('\\', "/")
                    )
                })
            })
            .or_else(|| {
                let root = Path::new(self.module_resolution.dependency_root.as_deref()?);
                let relative = path
                    .strip_prefix(root)
                    .ok()?
                    .to_string_lossy()
                    .replace('\\', "/");
                ancestor_roots::dependency_directory(&relative)?;
                Some(relative)
            })
    }

    /// Resolve a logical stylesheet source into this side's selected physical inputs.
    pub fn physical_source(&self, path: &str) -> PathBuf {
        if let Some(rest) = path.strip_prefix("node_modules/") {
            let (index, rest) = if let Some(rest) = rest.strip_prefix(".mokly-roots/") {
                let (index, rest) = rest.split_once('/').unwrap_or(("0", rest));
                (index.parse::<usize>().unwrap_or(0), rest)
            } else {
                (0, rest)
            };
            if let Some(root) = dependency_roots(self).get(index) {
                return root.join(rest);
            }
        }
        if ancestor_roots::dependency_directory(path).is_some()
            && let Some(root) = &self.module_resolution.dependency_root
        {
            return Path::new(root).join(path);
        }
        self.source_root.join(path)
    }
}
