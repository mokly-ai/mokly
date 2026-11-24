//! Injected stylesheet resolver; source access never reaches ambient files.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::{CssError, Result};
use crate::package::Package;
use crate::resolution::Resolution;
use crate::{lookup_roots, paths, workspace_sources};

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
        let (specifier, aliased) = self.alias(specifier);
        let relative_source = if aliased {
            format!("{}/package.json", self.settings.config_directory)
                .trim_start_matches('/')
                .to_owned()
        } else {
            importer.into()
        };
        if !aliased
            && let Some(relative) = paths::resolve(&relative_source, &specifier)
            && let Some(path) = self.file(&relative, None)
        {
            return Ok(path);
        }
        if specifier.starts_with('.') || specifier.starts_with('/') {
            return Err(failure());
        }
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
        let bases = lookup_roots::roots(&relative_source, &self.settings)
            .into_iter()
            .map(|root| format!("{root}/{package}"));
        for base in bases {
            let package = self
                .tree
                .read(&self.repo_root.join(&base).join("package.json"))
                .ok()
                .and_then(|bytes| Package::parse(&bytes, &self.settings));
            let workspace_root = package.as_ref().and_then(|_| self.workspace(&base));
            let workspace = workspace_root.as_deref().map(|root| (base.as_str(), root));
            if let Some(package) = package {
                if let Some(exports) = package.exports {
                    if let Some(target) = exports.resolve(&subpath, &self.settings)
                        && target.starts_with("./")
                        && let Some(path) = paths::resolve(&format!("{base}/package.json"), &target)
                        && let Some(path) = self.file(&path, workspace)
                    {
                        return Ok(path);
                    }
                    continue;
                }
                if subpath == "." {
                    for main in package.mains {
                        if let Some(path) = paths::resolve(&format!("{base}/package.json"), &main)
                            && let Some(path) = self.file(&path, workspace)
                        {
                            return Ok(path);
                        }
                    }
                }
            }
            let path = if subpath == "." {
                base.clone()
            } else {
                format!("{base}/{}", subpath.trim_start_matches("./"))
            };
            if let Some(path) = self.file(&path, workspace) {
                return Ok(path);
            }
        }
        Err(failure())
    }
}

impl SourceResolver {
    fn alias(&self, specifier: &str) -> (String, bool) {
        if let Some((name, replacement)) = self
            .settings
            .aliases
            .iter()
            .filter(|(name, _)| {
                specifier == *name
                    || specifier
                        .strip_prefix(name.as_str())
                        .is_some_and(|rest| rest.starts_with('/'))
            })
            .max_by_key(|(name, _)| name.len())
        {
            return (replacement.clone() + &specifier[name.len()..], true);
        }
        (specifier.into(), false)
    }
    fn workspace(&self, package: &str) -> Option<PathBuf> {
        let node = self.tree.project(&self.repo_root.join(package)).ok()??;
        (node.kind == FileKind::Directory
            && workspace_sources::repository_path(&self.repo_root, &node.identity))
        .then_some(node.identity)
    }

    fn file(&self, path: &str, workspace: Option<(&str, &Path)>) -> Option<String> {
        std::iter::once(path.to_owned())
            .chain(
                self.settings
                    .extension_order()
                    .map(|extension| format!("{path}{extension}")),
            )
            .chain(std::iter::once_with(|| format!("{path}/index.css")))
            .find_map(|file| {
                if let Some((base, root)) = workspace
                    && let Ok(relative) = Path::new(&file).strip_prefix(base)
                    && let Some(source) = workspace_sources::source(
                        self.tree.as_ref(),
                        &self.repo_root,
                        &root.join(relative),
                        &self.settings,
                    )
                    && let Ok(source) = source.strip_prefix(&self.repo_root)
                {
                    return Some(source.to_string_lossy().replace('\\', "/"));
                }
                regular(self.tree.as_ref(), &self.repo_root.join(&file)).then_some(file)
            })
    }
}

pub(crate) fn regular(tree: &dyn SourceTree, path: &Path) -> bool {
    matches!(tree.project(path), Ok(Some(node)) if node.kind == FileKind::File)
}
