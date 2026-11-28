//! Prepare CSS Modules before evaluation and retain Vite's stylesheet render inputs.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::thread;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_css::types::{Bundle as CssBundle, StylesheetBundler, StylesheetRoot};
use mokly_graph::render_inputs::preview_candidates;
use mokly_model::material::digest;
use mokly_sidecar::methods::Bundle;
use mokly_source_interface::tree::SourceTree;

use crate::error::{RenderError, Result};
use crate::render_environment::ClassMaps;
use crate::stylesheet_class_maps::ClassMapCompiler;
use crate::stylesheets;

#[derive(Default)]
pub(crate) struct BundleStyles {
    pub(crate) maps: ClassMaps,
    pub(crate) named_exports: ClassMaps,
    pub(crate) inputs: BTreeMap<String, String>,
    pub(crate) preview_inputs: BTreeMap<String, String>,
}

impl BundleStyles {
    pub(crate) fn fingerprint(&self) -> String {
        let bytes = if !self.preview_inputs.is_empty() {
            serde_json::to_vec(&(
                &self.maps,
                &self.named_exports,
                &self.inputs,
                &self.preview_inputs,
            ))
        } else if self.inputs.is_empty() && self.named_exports.is_empty() {
            serde_json::to_vec(&self.maps)
        } else {
            serde_json::to_vec(&(&self.maps, &self.named_exports, &self.inputs))
        }
        .expect("CSS Modules maps and input digests contain only strings and string-keyed maps");
        digest(&bytes)
    }

    fn add(&mut self, bundle: CssBundle, vite: bool, preview: Option<&str>) {
        self.maps.extend(bundle.css_modules);
        self.named_exports.extend(bundle.css_module_named_exports);
        if vite {
            let inputs = bundle
                .read_evidence
                .inputs
                .into_iter()
                .map(|(path, versions)| {
                    let hash = digest(format!("{versions:?}").as_bytes());
                    (path, hash)
                });
            if let Some(preview) = preview {
                let inputs = inputs.collect::<BTreeMap<_, _>>();
                let encoded = serde_json::to_vec(&inputs)
                    .expect("stylesheet input digests contain only strings and string keys");
                self.preview_inputs.insert(preview.into(), digest(&encoded));
            } else {
                self.inputs.extend(inputs);
            }
        }
    }
}

pub(crate) fn local_input_digest(
    compiler: &dyn StylesheetBundler,
    config: &ResolvedConfig,
    declarations: &BTreeMap<String, Vec<String>>,
) -> Result<Option<String>> {
    let mut styles = BundleStyles::default();
    for root in mokly_graph::styles::local_roots(config, declarations).values() {
        match compiler.bundle(root) {
            Ok(bundle) => styles.add(bundle, true, None),
            Err(source) => return Err(RenderError::Css { source }),
        }
    }
    Ok((!styles.inputs.is_empty()).then(|| styles.fingerprint()))
}

pub(crate) fn story_previews(
    modules: &BTreeMap<String, Vec<String>>,
    folders: &BTreeMap<String, String>,
    tree: &dyn SourceTree,
    root: &Path,
) -> BTreeMap<String, String> {
    let selected: BTreeMap<_, _> = folders
        .values()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .filter_map(|folder| {
            let path = preview_candidates(folder).find_map(|path| {
                if modules.contains_key(&path) {
                    return Some(path);
                }
                let node = tree.project(&root.join(path)).ok()??;
                let resolved = node.identity.strip_prefix(root).ok()?;
                let logical = resolved.to_string_lossy().replace('\\', "/");
                modules.contains_key(&logical).then_some(logical)
            })?;
            Some((folder, path))
        })
        .collect();
    folders
        .iter()
        .filter_map(|(story, folder)| Some((story.clone(), selected.get(folder)?.clone())))
        .collect()
}

pub(crate) struct ModuleRoots<'a> {
    pub(crate) modules: &'a BTreeMap<String, Vec<String>>,
    pub(crate) renderer: Option<&'a str>,
    pub(crate) entries: &'a [String],
    pub(crate) previews: &'a BTreeMap<String, String>,
    pub(crate) loaders: &'a BTreeMap<String, String>,
    pub(crate) vite: bool,
}

pub(crate) fn prepare_roots(
    compiler: &dyn StylesheetBundler,
    inputs: ModuleRoots<'_>,
) -> Result<Vec<StylesheetRoot>> {
    let previews: BTreeSet<_> = inputs.previews.values().map(String::as_str).collect();
    let order = inputs
        .renderer
        .into_iter()
        .chain(previews.iter().copied())
        .chain(inputs.entries.iter().map(String::as_str));
    let roots = stylesheets::scan_roots(inputs.modules, order, inputs.loaders, inputs.vite);
    let mut renderer_closure = BTreeSet::new();
    let mut preview_closures: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    let mut prepared = Vec::with_capacity(roots.len());
    for mut root in roots {
        let is_renderer = Some(root.path.as_str()) == inputs.renderer;
        let is_preview = previews.contains(root.path.as_str());
        if !is_renderer {
            let preview_closure = inputs
                .previews
                .get(&root.path)
                .and_then(|preview| preview_closures.get(preview));
            root.stylesheets.retain(|path| {
                !renderer_closure.contains(path)
                    && !preview_closure.is_some_and(|closure| closure.contains(path))
            });
            if !inputs.vite {
                root.excluded.clone_from(&renderer_closure);
                root.excluded
                    .extend(preview_closure.into_iter().flatten().cloned());
            }
        }
        if root.stylesheets.is_empty() && !is_preview {
            continue;
        }
        if is_renderer || is_preview {
            let closure = stylesheet_closure(compiler, &root, inputs.vite)?;
            if is_renderer {
                renderer_closure = closure;
            } else {
                preview_closures.insert(root.path.clone(), closure);
            }
        }
        prepared.push(root);
    }
    Ok(prepared)
}

fn stylesheet_closure(
    compiler: &dyn StylesheetBundler,
    root: &StylesheetRoot,
    vite: bool,
) -> Result<BTreeSet<String>> {
    let bundle = match compiler.bundle(root) {
        Ok(bundle) => bundle,
        Err(source) => return Err(RenderError::Css { source }),
    };
    let mut closure: BTreeSet<_> = bundle.inputs.into_keys().collect();
    if vite {
        closure.extend(bundle.dependency_digests.into_keys());
    }
    closure.retain(|path| {
        !stylesheets::css_module(path, vite) || bundle.css_modules.contains_key(path)
    });
    Ok(closure)
}

pub(crate) fn prepare(
    compiler: &dyn ClassMapCompiler,
    modules: &BTreeMap<String, Vec<String>>,
    params: &Bundle,
    previews: &BTreeMap<String, String>,
) -> Result<BundleStyles> {
    let entries: Vec<_> = params
        .entry_files
        .iter()
        .chain(&params.stories_files)
        .cloned()
        .collect();
    let loaders = &params.module_resolution.loaders;
    let roots = prepare_roots(
        compiler,
        ModuleRoots {
            modules,
            renderer: params.renderer.as_deref(),
            entries: &entries,
            previews,
            loaders,
            vite: params.vite,
        },
    )?;
    let mut styles = BundleStyles::default();
    if params.vite {
        let preview_paths: BTreeSet<_> = previews.values().map(String::as_str).collect();
        for root in roots {
            let preview = (params.renderer.as_deref() != Some(root.path.as_str())
                && preview_paths.contains(root.path.as_str()))
            .then_some(root.path.as_str());
            match compiler.bundle(&root) {
                Ok(bundle) => styles.add(bundle, true, preview),
                Err(source) => return Err(RenderError::Css { source }),
            }
        }
    } else {
        let parallelism = thread::available_parallelism().map_or(1, usize::from);
        styles.maps = match compiler.class_maps(&roots, parallelism) {
            Ok(maps) => maps,
            Err(source) => return Err(RenderError::Css { source }),
        };
    }
    for path in modules
        .keys()
        .filter(|path| stylesheets::css_module(path, params.vite))
    {
        if !styles.maps.contains_key(path) && !stylesheets::ignored_for(path, loaders, params.vite)
        {
            let root = StylesheetRoot {
                path: path.clone(),
                stylesheets: vec![path.clone()],
                excluded: Default::default(),
                local_css: true,
            };
            match compiler.bundle(&root) {
                Ok(bundle) => styles.add(bundle, params.vite, None),
                Err(source) => return Err(RenderError::Css { source }),
            }
        }
    }
    Ok(styles)
}

#[cfg(test)]
#[path = "_tests_/class_maps/uncovered_tests.rs"]
mod uncovered_tests;
