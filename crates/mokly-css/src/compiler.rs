//! Prepare stylesheet closures before the pure lightningcss bundler runs.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;

use lightningcss::stylesheet::{ParserOptions, StyleSheet};
use mokly_source_interface::tree::SourceTree;

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
    pub(crate) compiler: &'a Compiler,
    root: &'a StylesheetRoot,
    pub(crate) sources: BTreeMap<String, String>,
    pub(crate) resolutions: BTreeMap<(String, String), String>,
    pub(crate) result: Bundle,
}

pub(crate) struct AssetCandidate {
    pub(crate) route: String,
    pub(crate) target: String,
    pub(crate) url: String,
    pub(crate) importer: String,
}

impl StylesheetBundler for Compiler {
    #[tracing::instrument(name = "css.bundle", skip_all, err)]
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
                read_evidence: Default::default(),
                route,
                css: String::new(),
                assets: BTreeMap::new(),
                css_modules: BTreeMap::new(),
                inputs: BTreeMap::new(),
                imported_by: BTreeMap::new(),
                repository_aliases: Default::default(),
                dependency_digests: BTreeMap::new(),
                plugin_inputs: BTreeMap::new(),
                directories: Vec::new(),
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
        let processed = self
            .compiler
            .processor
            .process(path, &pruned, &self.root.excluded)?;
        self.result.plugin_inputs.extend(processed.plugin_inputs);
        self.result.read_evidence.extend(processed.read_evidence);
        self.result.directories.extend(processed.directories);
        self.result.dependency_digests.extend(processed.inputs);
        let mut edits = Vec::new();
        let mut assets = Vec::new();
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
                let (rewritten, candidate) = self.asset_reference(path, &reference.value)?;
                if let Some(candidate) = candidate {
                    assets.push(candidate);
                }
                edits.push((
                    reference.start,
                    reference.end,
                    format!("url(\"{rewritten}\")"),
                ));
            }
        }
        self.digest_assets(assets)?;
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
}
