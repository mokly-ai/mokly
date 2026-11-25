//! Deliver Vite's inline CSS without a second import walk or CSS Modules pass.

use std::collections::BTreeMap;

use mokly_model::material::digest;
use mokly_source_interface::read_evidence::ReadBaseline;

use crate::compiler::Compiler;
use crate::dependencies::PluginInput;
use crate::error::{AssetFailure, CssError, Result, TransformFailure};
use crate::types::{Bundle, StylesheetRoot};
use crate::{paths, syntax};

/// Vite's result for one local stylesheet.
pub struct Stylesheet {
    /// Inline CSS before asset delivery.
    pub text: String,
    /// The native CSS Modules exports.
    pub class_map: BTreeMap<String, String>,
    /// The named bindings in Vite's stylesheet module.
    pub named_exports: BTreeMap<String, String>,
    /// Digest of the physical file transformed by Vite.
    pub source_digest: String,
    /// Files read or reported by the transform.
    pub dependencies: BTreeMap<String, Option<String>>,
    /// Importers of stylesheet inputs that the transform did not report.
    pub imported_by: BTreeMap<String, String>,
    /// Vite setup files and resolution candidates, separate from the closure.
    pub metadata: BTreeMap<String, Option<String>>,
}

/// One side's native inline transforms.
pub trait Transform: Send + Sync {
    /// Transform the selected file, keeping native CSS Modules exports.
    fn stylesheet(&self, path: &str) -> Result<std::sync::Arc<Stylesheet>>;
}

/// Vite recognizes these stylesheet suffixes without case folding.
pub fn stylesheet(path: &str) -> bool {
    path.rsplit_once('.').is_some_and(|(_, suffix)| {
        matches!(
            suffix,
            "css" | "scss" | "sass" | "less" | "styl" | "stylus" | "pcss" | "postcss" | "sss"
        )
    })
}

/// A CSS Module uses the module segment followed by a Vite stylesheet suffix.
pub fn css_module(path: &str) -> bool {
    stylesheet(path)
        && path
            .rsplit_once('.')
            .is_some_and(|(stem, _)| stem.ends_with(".module"))
}

/// Non-CSS physical roots need a CSS suffix at delivery.
pub fn suffix(path: &str) -> &'static str {
    if path.ends_with(".css") { "" } else { ".css" }
}

/// Validate and deliver the root's already-transformed stylesheets in graph order.
pub fn bundle(
    compiler: &Compiler,
    root: &StylesheetRoot,
    transform: &dyn Transform,
) -> Result<Bundle> {
    let mut prepared = compiler.prepare(
        root,
        if root.local_css {
            suffix(&root.path)
        } else {
            ".css"
        },
    )?;
    for path in root
        .stylesheets
        .iter()
        .filter(|path| !root.excluded.contains(*path))
    {
        if prepared.sources.contains_key(path) {
            continue;
        }
        let bytes = prepared.source_bytes(path, path)?;
        let source = transform.stylesheet(path)?;
        if digest(&bytes) != source.source_digest {
            return Err(CssError::Transform {
                kind: TransformFailure::Syntax,
                message: format!("{path} changed during Vite compilation"),
            });
        }
        if css_module(path) {
            prepared
                .result
                .css_modules
                .insert(path.clone(), source.class_map.clone());
            prepared
                .result
                .css_module_named_exports
                .insert(path.clone(), source.named_exports.clone());
        }
        let origin = PluginInput {
            plugin: "unknown".into(),
            stylesheet: path.clone(),
        };
        for (dependency, digest) in &source.dependencies {
            let Some(digest) = digest else { continue };
            prepared
                .result
                .dependency_digests
                .insert(dependency.clone(), digest.clone());
            if dependency.split('/').any(|part| part == "node_modules") {
                continue;
            }
            if let Some(importer) = source.imported_by.get(dependency) {
                prepared
                    .result
                    .imported_by
                    .insert(dependency.clone(), importer.clone());
            } else {
                prepared
                    .result
                    .plugin_inputs
                    .insert(dependency.clone(), origin.clone());
            }
        }
        for (path, digest) in source.dependencies.iter().chain(&source.metadata) {
            prepared.result.resolution_files.insert(path.clone());
            if let Some(digest) = digest {
                prepared
                    .result
                    .read_evidence
                    .insert(path.clone(), ReadBaseline::Late(digest.clone()));
            }
        }
        let mut edits = Vec::new();
        for reference in syntax::references(&source.text) {
            if paths::external(&reference.value) {
                continue;
            }
            if reference.import {
                return Err(import_error(path, &reference));
            }
            if reference.image_set_string {
                return Err(CssError::Asset {
                    kind: AssetFailure::ImageSet,
                    message: format!(
                        "image-set() string URL is unsupported in {path}: {}; wrap the URL in url() so Mokly can validate and deliver the asset",
                        reference.value
                    ),
                });
            }
            let rewritten = prepared.asset(path, &reference.value)?;
            edits.push((
                reference.start,
                reference.end,
                format!("url(\"{rewritten}\")"),
            ));
        }
        let text = syntax::replace(path, &source.text, edits)?;
        prepared.sources.insert(path.clone(), text);
    }
    prepared.finish()
}

fn import_error(path: &str, reference: &syntax::Reference) -> CssError {
    if reference.late {
        CssError::Transform {
            kind: TransformFailure::LateImport,
            message: format!(
                "CSS @import must come before style rules in {path}: {}; move the import before other rules",
                reference.value
            ),
        }
    } else {
        CssError::Import {
            stylesheet: path.into(),
            specifier: reference.value.clone(),
        }
    }
}
