//! Prepare stylesheet closures before the pure lightningcss bundler runs.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;

use lightningcss::stylesheet::{ParserOptions, StyleSheet};
use mokly_model::routes;
use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::{AssetFailure, CssError, Result, TransformFailure};
use crate::resolver::ImportResolver;
use crate::types::{Bundle, CssProcessor, StylesheetBundler, StylesheetRoot};
use crate::{delivery, modules, paths, syntax};

/// Source-tree compiler with injected resolution and consumer processing.
pub struct Compiler {
    /// Working tree or Git blob source.
    pub tree: Arc<dyn SourceTree>,
    /// Tree-local repository identity.
    pub repo_root: PathBuf,
    /// Consumer-compatible stylesheet resolver.
    pub resolver: Arc<dyn ImportResolver>,
    /// Identity or sidecar PostCSS step.
    pub processor: Arc<dyn CssProcessor>,
}

pub(crate) struct Preparation<'a> {
    compiler: &'a Compiler,
    root: &'a StylesheetRoot,
    pub(crate) sources: BTreeMap<String, String>,
    pub(crate) resolutions: BTreeMap<(String, String), String>,
    pub(crate) result: Bundle,
}

impl StylesheetBundler for Compiler {
    fn bundle(&self, root: &StylesheetRoot) -> Result<Bundle> {
        if !paths::portable(&root.path, false) {
            return Err(CssError::RootRoute {
                path: root.path.clone(),
            });
        }
        let route = format!(
            "styles/{}{}",
            root.path,
            if root.local_css { "" } else { ".css" }
        );
        let mut preparation = Preparation {
            compiler: self,
            root,
            sources: BTreeMap::new(),
            resolutions: BTreeMap::new(),
            result: Bundle {
                route,
                css: String::new(),
                assets: BTreeMap::new(),
                css_modules: BTreeMap::new(),
                inputs: BTreeMap::new(),
                imported_by: BTreeMap::new(),
            },
        };
        let mut imports = String::new();
        for stylesheet in &root.stylesheets {
            if root.excluded.contains(stylesheet) {
                continue;
            }
            preparation.source(stylesheet, stylesheet)?;
            imports.push_str(&format!("@import \"{}\";\n", stylesheet));
            preparation
                .resolutions
                .insert((root.path.clone(), stylesheet.clone()), stylesheet.clone());
        }
        let synthetic = format!("{}.mokly-root.css", root.path);
        for stylesheet in &root.stylesheets {
            preparation
                .resolutions
                .insert((synthetic.clone(), stylesheet.clone()), stylesheet.clone());
        }
        preparation.sources.insert(synthetic.clone(), imports);
        preparation.result.css = delivery::bundle(&synthetic, &preparation)?;
        tracing::debug!(
            root = root.path,
            inputs = preparation.result.inputs.len(),
            "stylesheet bundled"
        );
        Ok(preparation.result)
    }
}

impl Preparation<'_> {
    fn source(&mut self, path: &str, importer: &str) -> Result<()> {
        if self.sources.contains_key(path) {
            return Ok(());
        }
        let bytes = self.read(path).ok_or_else(|| CssError::Import {
            stylesheet: importer.into(),
            specifier: path.into(),
        })?;
        let source = match String::from_utf8(bytes.clone()) {
            Ok(source) => source,
            Err(_) => {
                return Err(CssError::Import {
                    stylesheet: importer.into(),
                    specifier: path.into(),
                });
            }
        };
        self.sources.insert(path.into(), String::new());
        self.result.inputs.insert(path.into(), bytes.clone());
        self.alias(path, &bytes, importer);
        self.result
            .imported_by
            .entry(path.into())
            .or_insert_with(|| importer.into());
        let mut edits = Vec::new();
        for reference in syntax::references(&source)
            .into_iter()
            .filter(|reference| reference.import && !paths::external(&reference.value))
        {
            if reference.late {
                return Err(CssError::Transform {
                    kind: TransformFailure::LateImport,
                    message: format!(
                        "CSS @import must come before style rules in {path}: {}; move the import before other rules",
                        reference.value
                    ),
                });
            }
            let target = self.compiler.resolver.resolve(path, &reference.value)?;
            if self.root.excluded.contains(&target)
                && let Some((start, end)) = reference.rule
            {
                edits.push((start, end, String::new()));
            }
        }
        let pruned = syntax::replace(path, &source, edits)?;
        let processed = self.compiler.processor.process(path, &pruned)?;
        self.result.inputs.extend(processed.inputs);
        let mut edits = Vec::new();
        for reference in syntax::references(&processed.text) {
            if reference.image_set_string && !paths::external(&reference.value) {
                return Err(CssError::Asset {
                    kind: AssetFailure::ImageSet,
                    message: format!(
                        "image-set() string URL is unsupported in {path}: {}; wrap the URL in url() so Mokly can validate and deliver the asset",
                        reference.value
                    ),
                });
            }
            if paths::external(&reference.value) {
                continue;
            }
            if reference.import {
                let target = self.compiler.resolver.resolve(path, &reference.value)?;
                if self.root.excluded.contains(&target) {
                    if let Some((start, end)) = reference.rule {
                        edits.push((start, end, String::new()));
                    }
                } else {
                    self.resolutions
                        .insert((path.into(), reference.value), target.clone());
                    self.source(&target, path)?;
                }
            } else {
                let rewritten = self.asset(path, &reference.value)?;
                edits.push((
                    reference.start,
                    reference.end,
                    format!("url(\"{rewritten}\")"),
                ));
            }
        }
        let transformed = syntax::replace(path, &processed.text, edits)?;
        let transformed = if path.ends_with(".module.css") {
            let (text, exports) = modules::scope(path, &transformed)?;
            self.result.css_modules.insert(path.into(), exports);
            text
        } else {
            if let Err(error) = StyleSheet::parse(
                &transformed,
                ParserOptions {
                    filename: path.into(),
                    ..Default::default()
                },
            ) {
                return Err(CssError::Transform {
                    kind: TransformFailure::Syntax,
                    message: format!(
                        "could not transform CSS {path}: {}; fix the stylesheet and rebuild",
                        error.kind
                    ),
                });
            }
            transformed
        };
        self.sources.insert(path.into(), transformed);
        Ok(())
    }

    fn read(&self, path: &str) -> Option<Vec<u8>> {
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

    fn alias(&mut self, path: &str, bytes: &[u8], importer: &str) {
        if let Ok(Some(node)) = self
            .compiler
            .tree
            .project(&self.compiler.repo_root.join(path))
            && let Ok(identity) = node.identity.strip_prefix(&self.compiler.repo_root)
        {
            let identity = identity.to_string_lossy().replace('\\', "/");
            if identity != path {
                self.result.inputs.insert(identity.clone(), bytes.to_vec());
                self.result.imported_by.insert(identity, importer.into());
            }
        }
    }

    fn asset(&mut self, stylesheet: &str, url: &str) -> Result<String> {
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
