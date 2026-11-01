//! Confined CSS assets and physical alias inventory.

use mokly_model::routes;
use mokly_source_interface::tree::{FileKind, Node};
use std::collections::BTreeSet;

use crate::compiler::AssetCandidate;
use crate::compiler::Preparation;
use crate::error::{AssetFailure, CssError, Result};
use crate::paths;
use crate::types::OpaqueAsset;

impl Preparation<'_> {
    fn confined_node(&self, path: &str) -> Option<Node> {
        let mut cursor = self.compiler.repo_root.clone();
        for part in path.split('/') {
            if matches!(part, "" | "." | "..") || part.contains(['\\', ':', '\0']) {
                return None;
            }
            cursor.push(part);
            let node = self.compiler.tree.project(&cursor).ok()??;
            if (node.lexical_kind == FileKind::Symlink
                && !cursor
                    .components()
                    .any(|part| part.as_os_str() == "node_modules"))
                || !node.identity.starts_with(&self.compiler.repo_root)
            {
                return None;
            }
        }
        self.compiler
            .tree
            .project(&cursor)
            .ok()?
            .filter(|node| node.kind == FileKind::File)
    }

    pub(crate) fn read(&self, path: &str) -> Option<Vec<u8>> {
        self.confined_node(path)?;
        self.compiler
            .tree
            .read(&self.compiler.repo_root.join(path))
            .ok()
    }

    pub(crate) fn alias(&mut self, path: &str, bytes: &[u8], importer: &str) {
        if let Ok(Some(node)) = self
            .compiler
            .tree
            .project(&self.compiler.repo_root.join(path))
            && let Ok(identity) = node.identity.strip_prefix(&self.compiler.repo_root)
        {
            let identity = identity.to_string_lossy().replace('\\', "/");
            if identity != path {
                if !identity.split('/').any(|part| part == "node_modules") {
                    self.result.repository_aliases.insert(path.into());
                    self.result.repository_aliases.insert(identity.clone());
                }
                self.result.inputs.insert(identity.clone(), bytes.to_vec());
                self.result.imported_by.insert(identity, importer.into());
            }
        }
    }

    pub(crate) fn asset_reference(
        &mut self,
        stylesheet: &str,
        url: &str,
    ) -> Result<(String, Option<AssetCandidate>)> {
        if url.starts_with('/') {
            return Err(CssError::Asset {
                kind: AssetFailure::Absolute,
                message: format!(
                    "root-absolute CSS url() is not portable in {stylesheet}: {url}; use a path relative to the stylesheet"
                ),
            });
        }
        let (path, suffix) = url
            .find(['?', '#'])
            .map_or((url, ""), |index| (&url[..index], &url[index..]));
        let target = paths::resolve(stylesheet, path);
        let failure = || CssError::Asset {
            kind: AssetFailure::File,
            message: format!(
                "CSS asset is not a regular file inside repoRoot in {stylesheet}: {url}; move it inside the repository or fix the relative path"
            ),
        };
        let target = target.ok_or_else(failure)?;
        if paths::content_type(&target).is_none() {
            return Err(CssError::Asset {
                kind: AssetFailure::Extension,
                message: format!(
                    "unsupported CSS asset extension in {stylesheet}: {url}; use .avif, .bmp, .gif, .ico, .jpeg, .jpg, .png, .svg, .webp, .eot, .otf, .ttf, .woff or .woff2"
                ),
            });
        }
        if !paths::portable(&target, true) {
            return Err(CssError::Asset {
                kind: AssetFailure::Route,
                message: format!(
                    "CSS asset route is not portable: {target}; rename every path segment to be URL-safe (letters, digits, dot, underscore, tilde or hyphen; @scope only after node_modules; no spaces or device names)"
                ),
            });
        }
        let asset_route = format!("assets/{target}");
        let candidate = if self.result.assets.contains_key(&asset_route) {
            None
        } else {
            Some(AssetCandidate {
                node: self.confined_node(&target).ok_or_else(failure)?,
                route: asset_route.clone(),
                target: target.clone(),
                url: url.into(),
                importer: stylesheet.into(),
            })
        };
        if let Some(asset) = self.result.assets.get(&asset_route) {
            for alias in &asset.aliases {
                self.result
                    .imported_by
                    .insert(alias.clone(), stylesheet.into());
            }
        }
        self.result
            .imported_by
            .entry(target)
            .or_insert_with(|| stylesheet.into());
        Ok((
            routes::relative(&self.result.route, &asset_route).replace("%40", "@") + suffix,
            candidate,
        ))
    }

    pub(crate) fn digest_assets(&mut self, candidates: Vec<AssetCandidate>) -> Result<()> {
        let mut seen = BTreeSet::new();
        let unique: Vec<_> = candidates
            .into_iter()
            .filter(|candidate| seen.insert(candidate.route.clone()))
            .collect();
        if unique.is_empty() {
            return Ok(());
        }
        let paths: Vec<_> = unique
            .iter()
            .map(|candidate| candidate.node.identity.clone())
            .collect();
        let digests = self.compiler.tree.digest_unretained_batch(&paths);
        for (candidate, digest) in unique.into_iter().zip(digests) {
            let failure = || CssError::Asset {
                kind: AssetFailure::File,
                message: format!(
                    "CSS asset is not a regular file inside repoRoot in {}: {}; move it inside the repository or fix the relative path",
                    candidate.importer, candidate.url
                ),
            };
            let node = candidate.node;
            let digest = match digest {
                Ok(digest) => digest,
                Err(_) => return Err(failure()),
            };
            let mut aliases = Vec::new();
            if let Ok(identity) = node.identity.strip_prefix(&self.compiler.repo_root) {
                let identity = identity.to_string_lossy().replace('\\', "/");
                if identity != candidate.target {
                    if !identity.split('/').any(|part| part == "node_modules") {
                        self.result
                            .repository_aliases
                            .insert(candidate.target.clone());
                        self.result.repository_aliases.insert(identity.clone());
                    }
                    self.result
                        .imported_by
                        .insert(identity.clone(), candidate.importer.clone());
                    aliases.push(identity);
                }
            }
            self.result.assets.insert(
                candidate.route,
                OpaqueAsset {
                    path: candidate.target,
                    source: node.identity,
                    digest,
                    aliases,
                },
            );
        }
        Ok(())
    }
}
