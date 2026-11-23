//! Prepare CSS Modules before evaluation and retain Vite's stylesheet render inputs.

use std::collections::BTreeMap;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_css::types::{Bundle as CssBundle, StylesheetBundler, StylesheetRoot};
use mokly_css::vite;
use mokly_model::material::digest;
use mokly_sidecar::methods::Bundle;

use crate::error::{RenderError, Result};
use crate::render_environment::ClassMaps;
use crate::stylesheets;

#[derive(Default)]
pub(crate) struct BundleStyles {
    pub(crate) maps: ClassMaps,
    pub(crate) inputs: BTreeMap<String, String>,
}

impl BundleStyles {
    pub(crate) fn fingerprint(&self) -> String {
        let bytes = if self.inputs.is_empty() {
            serde_json::to_vec(&self.maps)
        } else {
            serde_json::to_vec(&(&self.maps, &self.inputs))
        }
        .expect("CSS Modules maps and input digests contain only strings and string-keyed maps");
        digest(&bytes)
    }

    fn add(&mut self, bundle: CssBundle, vite: bool) {
        self.maps.extend(bundle.css_modules);
        if vite {
            self.inputs.extend(
                bundle
                    .read_evidence
                    .inputs
                    .into_iter()
                    .map(|(path, versions)| {
                        let hash = digest(format!("{versions:?}").as_bytes());
                        (path, hash)
                    }),
            );
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
            Ok(bundle) => styles.add(bundle, true),
            Err(source) => return Err(RenderError::Css { source }),
        }
    }
    Ok((!styles.inputs.is_empty()).then(|| styles.fingerprint()))
}

pub(crate) fn prepare(
    compiler: &dyn StylesheetBundler,
    modules: &BTreeMap<String, Vec<String>>,
    params: &Bundle,
) -> Result<BundleStyles> {
    let entries: Vec<_> = params
        .entry_files
        .iter()
        .chain(&params.stories_files)
        .cloned()
        .collect();
    let loaders = &params.module_resolution.loaders;
    let roots = stylesheets::prepare_roots(
        modules,
        params.renderer.as_deref(),
        &entries,
        loaders,
        params.vite.then_some(compiler),
    )?;
    let mut styles = BundleStyles::default();
    for root in roots {
        match compiler.bundle(&root) {
            Ok(bundle) => styles.add(bundle, params.vite),
            Err(source) => return Err(RenderError::Css { source }),
        }
    }
    for path in modules.keys().filter(|path| {
        if params.vite {
            vite::css_module(path)
        } else {
            path.ends_with(".module.css")
        }
    }) {
        if !styles.maps.contains_key(path) && !stylesheets::ignored_for(path, loaders, params.vite)
        {
            let root = StylesheetRoot {
                path: path.clone(),
                stylesheets: vec![path.clone()],
                excluded: Default::default(),
                local_css: true,
            };
            match compiler.bundle(&root) {
                Ok(bundle) => styles.add(bundle, params.vite),
                Err(source) => return Err(RenderError::Css { source }),
            }
        }
    }
    Ok(styles)
}
