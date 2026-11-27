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
        let failure = |package| match package {
            Some(package) => CssError::WorkspaceImport {
                stylesheet: importer.into(),
                specifier: specifier.into(),
                package,
            },
            None => CssError::Import {
                stylesheet: importer.into(),
                specifier: specifier.into(),
            },
        };
        let (specifier, aliased) = self.alias(specifier);
        let relative_source = if aliased {
            format!("{}/package.json", self.settings.config_directory)
                .trim_start_matches('/')
                .to_owned()
        } else {
            importer.into()
        };
        let relative = (!aliased)
            .then(|| paths::resolve(&relative_source, &specifier))
            .flatten();
        if let Some(path) = relative.as_deref().and_then(|path| self.file(path, None)) {
            return Ok(path);
        }
        if specifier.starts_with('.') || specifier.starts_with('/') {
            return Err(failure(None));
        }
        let parts: Vec<_> = specifier.split('/').collect();
        let package_segments = if specifier.starts_with('@') { 2 } else { 1 };
        if parts.len() < package_segments {
            return Err(failure(None));
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
        let mut missing_package = None;
        for base in bases {
            let workspace_root = self.workspace(&base);
            let manifest_root = workspace_root
                .clone()
                .unwrap_or_else(|| self.repo_root.join(&base));
            let package = self
                .tree
                .read(&manifest_root.join("package.json"))
                .ok()
                .and_then(|bytes| Package::parse(&bytes, &self.settings));
            let workspace = workspace_root.as_deref().map(|root| (base.as_str(), root));
            let mut file = |path: &str| {
                let resolved = self.file(path, workspace);
                if resolved.is_none()
                    && missing_package.is_none()
                    && let Some((base, root)) = workspace
                    && let Ok(relative) = Path::new(path).strip_prefix(base)
                    && !relative.as_os_str().is_empty()
                {
                    missing_package = workspace_sources::override_hint(
                        self.tree.as_ref(),
                        &self.repo_root,
                        &root.join(relative),
                        &self.settings,
                    );
                }
                resolved
            };
            if let Some(package) = package {
                if let Some(exports) = package.exports {
                    if let Some(target) = exports.resolve(&subpath, &self.settings)
                        && target.starts_with("./")
                        && let Some(path) = paths::resolve(&format!("{base}/package.json"), &target)
                        && let Some(path) = file(&path)
                    {
                        return Ok(path);
                    }
                    continue;
                }
                if subpath == "." {
                    for main in package.mains {
                        if let Some(path) = paths::resolve(&format!("{base}/package.json"), &main)
                            && let Some(path) = file(&path)
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
            if let Some(path) = file(&path) {
                return Ok(path);
            }
        }
        Err(failure(missing_package))
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
                let Some(target) = workspace.and_then(|(base, root)| {
                    Some(root.join(Path::new(&file).strip_prefix(base).ok()?))
                }) else {
                    return regular(self.tree.as_ref(), &self.repo_root.join(&file))
                        .then_some(file);
                };
                self.workspace_file(file, &target)
            })
    }

    fn workspace_file(&self, file: String, target: &Path) -> Option<String> {
        let tree = self.tree.as_ref();
        let root = &self.repo_root;
        if let Some(source) = workspace_sources::source(tree, root, target, &self.settings) {
            return Some(
                source
                    .strip_prefix(root)
                    .ok()?
                    .to_string_lossy()
                    .replace('\\', "/"),
            );
        }
        let kept = workspace_sources::regular_file(tree, root, target)?;
        if tree
            .project(&root.join(&file))
            .ok()
            .flatten()
            .is_some_and(|node| node.kind == FileKind::File && node.identity == kept)
        {
            return Some(file);
        }
        Some(
            target
                .strip_prefix(root)
                .ok()?
                .to_string_lossy()
                .replace('\\', "/"),
        )
    }
}

pub(crate) fn regular(tree: &dyn SourceTree, path: &Path) -> bool {
    matches!(tree.project(path), Ok(Some(node)) if node.kind == FileKind::File)
}
