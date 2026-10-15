//! Confined CSS assets and physical alias inventory.

use mokly_model::routes;
use mokly_source_interface::tree::FileKind;

use crate::compiler::Preparation;
use crate::error::{AssetFailure, CssError, Result};
use crate::paths;

impl Preparation<'_> {
    pub(crate) fn read(&self, path: &str) -> Option<Vec<u8>> {
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
        if !matches!(self.compiler.tree.project(&cursor), Ok(Some(node)) if node.kind == FileKind::File)
        {
            return None;
        }
        self.compiler.tree.read(&cursor).ok()
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

    pub(crate) fn asset(&mut self, stylesheet: &str, url: &str) -> Result<String> {
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
        let bytes = self.read(&target).ok_or_else(failure)?;
        let asset_route = format!("assets/{target}");
        self.result.inputs.insert(target.clone(), bytes.clone());
        self.alias(&target, &bytes, stylesheet);
        self.result
            .imported_by
            .entry(target.clone())
            .or_insert_with(|| stylesheet.into());
        self.result.assets.insert(asset_route.clone(), bytes);
        Ok(routes::relative(&self.result.route, &asset_route).replace("%40", "@") + suffix)
    }
}
