//! Injected stylesheet resolver; source access never reaches ambient files.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::{CssError, Result};
use crate::package::Package;
use crate::paths;
use crate::resolution::Resolution;

/// Shared CSS resolution boundary. Sidecar adapters supply consumer settings.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ImportResolverMock))]
pub trait ImportResolver: Send + Sync {
    /// Resolve an authored import to a repository-relative logical CSS path.
    fn resolve(&self, importer: &str, specifier: &str) -> Result<String>;
}

/// Relative CSS imports and Node-style package stylesheet entrypoints.
pub struct SourceResolver {
    /// Working or Git tree reader.
    pub tree: Arc<dyn SourceTree>,
    /// Tree-local repository root.
    pub repo_root: PathBuf,
    /// Resolution settings shared with consumer bundling.
    pub settings: Resolution,
}

impl ImportResolver for SourceResolver {
    fn resolve(&self, importer: &str, specifier: &str) -> Result<String> {
        let failure = || CssError::Import {
            stylesheet: importer.into(),
            specifier: specifier.into(),
        };
        let (specifier, aliased) = self.alias(specifier).ok_or_else(failure)?;
        let relative_source = if aliased {
            format!("{}/package.json", self.settings.config_directory)
                .trim_start_matches('/')
                .to_owned()
        } else {
            importer.into()
        };
        if let Some(relative) = paths::resolve(&relative_source, &specifier)
            && let Some(path) = self.file(&relative)
        {
            return Ok(path);
        }
        if specifier.starts_with('.') || specifier.starts_with('/') {
            return Err(failure());
        }
        let mut directories = Vec::new();
        let mut directory = Path::new(importer).parent();
        while let Some(base) = directory {
            directories.push(base.to_string_lossy().into_owned());
            directory = base.parent();
        }
        directories.extend(self.settings.package_roots.clone());
        let parts: Vec<_> = specifier.split('/').collect();
        let package_segments = if specifier.starts_with('@') { 2 } else { 1 };
        if parts.len() < package_segments {
            return Err(failure());
        }
        let package = parts[..package_segments].join("/");
        let subpath = if parts.len() == package_segments {
            ".".into()
        } else {
            format!("./{}", parts[package_segments..].join("/"))
        };
        for directory in directories {
            let base = format!("{directory}/node_modules/{package}")
                .trim_start_matches('/')
                .to_owned();
            if let Ok(bytes) = self
                .tree
                .read(&self.repo_root.join(&base).join("package.json"))
                && let Some(package) = Package::parse(&bytes, &self.settings)
            {
                if let Some(exports) = package.exports {
                    if let Some(target) = exports.resolve(&subpath, &self.settings)
                        && target.starts_with("./")
                        && let Some(path) = paths::resolve(&format!("{base}/package.json"), &target)
                        && let Some(path) = self.file(&path)
                    {
                        return Ok(path);
                    }
                    continue;
                }
                if subpath == "." {
                    for main in package.mains {
                        if let Some(path) = paths::resolve(&format!("{base}/package.json"), &main)
                            && let Some(path) = self.file(&path)
                        {
                            return Ok(path);
                        }
                    }
                }
            }
            let path = if subpath == "." {
                base
            } else {
                format!("{base}/{}", subpath.trim_start_matches("./"))
            };
            if let Some(path) = self.file(&path) {
                return Ok(path);
            }
        }
        Err(failure())
    }
}

impl SourceResolver {
    fn alias(&self, specifier: &str) -> Option<(String, bool)> {
        let mut value = specifier.to_owned();
        let mut seen = BTreeSet::new();
        let mut aliased = false;
        while let Some((name, replacement)) = self
            .settings
            .aliases
            .iter()
            .filter(|(name, _)| {
                value == **name
                    || value
                        .strip_prefix(name.as_str())
                        .is_some_and(|rest| rest.starts_with('/'))
            })
            .max_by_key(|(name, _)| name.len())
        {
            if !seen.insert(value.clone()) {
                return None;
            }
            value = replacement.clone() + &value[name.len()..];
            aliased = true;
        }
        Some((value, aliased))
    }
    fn file(&self, path: &str) -> Option<String> {
        if regular(self.tree.as_ref(), &self.repo_root.join(path)) {
            return Some(path.into());
        }
        let extensions = if self.settings.extensions.is_empty() {
            vec![".tsx", ".ts", ".jsx", ".js", ".css", ".json"]
        } else {
            self.settings
                .extensions
                .iter()
                .map(String::as_str)
                .collect()
        };
        for extension in extensions {
            let file = format!("{path}{extension}");
            if regular(self.tree.as_ref(), &self.repo_root.join(&file)) {
                return Some(file);
            }
        }
        let index = format!("{path}/index.css");
        regular(self.tree.as_ref(), &self.repo_root.join(&index)).then_some(index)
    }
}

pub(crate) fn regular(tree: &dyn SourceTree, path: &Path) -> bool {
    matches!(tree.project(path), Ok(Some(node)) if node.kind == FileKind::File)
}
